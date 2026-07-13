import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationCase } from "./EvaluationCase";
import type { RagEvaluationCaseMetadata } from "./RagEvaluationDataset";
import type { RetrievalFailureCategory } from "./RetrievalFailureCategory";

/** Matches Recall@5 (RetrievalMetricsEvaluationRunner): the window a RAG prompt would realistically draw context from. */
const SUCCESS_RANK_THRESHOLD = 5;

export interface RetrievalCaseAnalysis {
  caseId: string;
  name: string;
  query: string;
  expectedDocumentIds: string[];
  retrievedDocumentIds: string[];
  /** 1-indexed rank of the first expected document found in the retrieved list, or undefined if never found. */
  rank: number | undefined;
  /** false for cases with no expected documents (e.g. negative/out-of-domain cases) — excluded from failure analysis. */
  applicable: boolean;
  /** true when an expected document was found within the top-5 window. */
  success: boolean;
  failureCategory: RetrievalFailureCategory | undefined;
  variationGroup: string | undefined;
}

type PartialAnalysis = Omit<RetrievalCaseAnalysis, "failureCategory">;

function firstRank(expected: string[], retrieved: string[]): number | undefined {
  const expectedIds = new Set(expected);
  for (let index = 0; index < retrieved.length; index += 1) {
    if (expectedIds.has(retrieved[index])) {
      return index + 1;
    }
  }
  return undefined;
}

function statutePrefix(documentId: string): string {
  const separatorIndex = documentId.indexOf(":");
  return separatorIndex === -1 ? documentId : documentId.slice(0, separatorIndex);
}

function variationGroupOf(evaluationCase: EvaluationCase): string | undefined {
  const metadata = evaluationCase.metadata as Partial<RagEvaluationCaseMetadata> | undefined;
  return metadata?.variationGroup;
}

async function isMissingFromCorpus(
  expectedDocumentIds: string[],
  repository: LegalDocumentRepository,
): Promise<boolean> {
  const lookups = await Promise.all(expectedDocumentIds.map((id) => repository.getById(id)));
  return lookups.every((document) => document === null);
}

function hasSameStatuteSibling(expectedDocumentIds: string[], topWindow: string[]): boolean {
  const expectedPrefixes = new Set(expectedDocumentIds.map(statutePrefix));
  return topWindow.some(
    (id) => expectedPrefixes.has(statutePrefix(id)) && !expectedDocumentIds.includes(id),
  );
}

async function classifyFailure(
  partial: PartialAnalysis,
  repository: LegalDocumentRepository,
  succeededVariationGroups: Set<string>,
): Promise<RetrievalFailureCategory> {
  if (await isMissingFromCorpus(partial.expectedDocumentIds, repository)) {
    return "missing-indexed-content";
  }

  if (partial.variationGroup && succeededVariationGroups.has(partial.variationGroup)) {
    // A differently-worded sibling question about the same document(s)
    // succeeded, so the document is findable — this phrasing is the problem.
    return "query-wording-mismatch";
  }

  if (partial.rank !== undefined) {
    return "retrieved-outside-top-5";
  }

  if (partial.retrievedDocumentIds.length === 0) {
    return "expected-document-not-retrieved";
  }

  const topWindow = partial.retrievedDocumentIds.slice(0, SUCCESS_RANK_THRESHOLD);
  if (hasSameStatuteSibling(partial.expectedDocumentIds, topWindow)) {
    return "similar-article-competition";
  }

  return "wrong-document-ranked-higher";
}

/**
 * Runs the given (unmodified) Retriever over every evaluation case, records
 * the retrieved ranking, and classifies the outcome. Measurement only — the
 * Retriever, SearchEngine, and OpenSearch query are never touched.
 *
 * This runs in two passes: pass 1 retrieves and ranks every case; pass 2
 * classifies failures using cross-case signal from pass 1 (specifically,
 * whether a sibling case in the same `variationGroup` succeeded), so all
 * cases must be analyzed together rather than one at a time.
 */
export async function analyzeRetrievalFailures(
  cases: EvaluationCase[],
  retriever: Retriever,
  repository: LegalDocumentRepository,
): Promise<RetrievalCaseAnalysis[]> {
  const partials: PartialAnalysis[] = await Promise.all(
    cases.map(async (evaluationCase) => {
      const expectedDocumentIds = evaluationCase.expectedDocumentIds ?? [];
      const applicable = expectedDocumentIds.length > 0;
      const retrievalResult = await retriever.retrieve(evaluationCase.query);
      const retrievedDocumentIds = retrievalResult.documents.map(
        (retrievedDocument) => retrievedDocument.document.id,
      );
      const rank = applicable ? firstRank(expectedDocumentIds, retrievedDocumentIds) : undefined;
      const success = applicable && rank !== undefined && rank <= SUCCESS_RANK_THRESHOLD;

      return {
        caseId: evaluationCase.id,
        name: evaluationCase.name,
        query: evaluationCase.query,
        expectedDocumentIds,
        retrievedDocumentIds,
        rank,
        applicable,
        success,
        variationGroup: variationGroupOf(evaluationCase),
      };
    }),
  );

  const succeededVariationGroups = new Set(
    partials
      .filter((partial) => partial.applicable && partial.success && partial.variationGroup)
      .map((partial) => partial.variationGroup!),
  );

  const analyses: RetrievalCaseAnalysis[] = [];
  for (const partial of partials) {
    if (!partial.applicable || partial.success) {
      analyses.push({ ...partial, failureCategory: undefined });
      continue;
    }

    const failureCategory = await classifyFailure(partial, repository, succeededVariationGroups);
    analyses.push({ ...partial, failureCategory });
  }

  return analyses;
}
