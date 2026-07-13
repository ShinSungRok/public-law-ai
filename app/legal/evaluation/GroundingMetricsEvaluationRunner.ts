import type { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";
import { analyzeClaims } from "./GroundingAnalyzer";
import {
  computeCitationCoverage,
  computeContextCoverage,
  computeGroundedAnswerScore,
  computeUnsupportedClaimCount,
} from "./GroundingMetricsCalculator";

export const CONTEXT_COVERAGE_METRIC_NAME = "context-coverage";
export const GROUNDED_ANSWER_METRIC_NAME = "grounded-answer";
export const UNSUPPORTED_CLAIMS_METRIC_NAME = "unsupported-claims";
export const CITATION_COVERAGE_METRIC_NAME = "citation-coverage";

const PERFECT_SCORE = 1;
const NO_UNSUPPORTED_CLAIMS = 0;

function summarize(results: EvaluationResult[]): EvaluationSummary {
  const passedCount = results.filter((result) => result.passed).length;

  return {
    totalCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
  };
}

/**
 * Measures answer grounding (Context Coverage, Grounded Answer, Unsupported
 * Claims, Citation Coverage) for the `rag-answer`-target cases in the RAG
 * evaluation dataset. Wraps the existing, unmodified `Retriever` and
 * `GenerateRagAnswerUseCase` unchanged — this only observes their output, it
 * never alters retrieval, prompting, or generation behavior. Reuses
 * RetrievalMetricsCalculator (via GroundingMetricsCalculator) and
 * GroundingAnalyzer's claim classification rather than duplicating either.
 *
 * A second runner for the `rag-answer` target alongside `RagAnswerEvaluationRunner`
 * mirrors the precedent set by `RetrievalMetricsEvaluationRunner` existing
 * alongside `RetrievalEvaluationRunner` for the `retrieval` target: each
 * runner owns a distinct set of metrics for the same target rather than one
 * runner accreting unrelated concerns.
 */
export class GroundingMetricsEvaluationRunner implements EvaluationRunner {
  constructor(
    private readonly retriever: Retriever,
    private readonly generateRagAnswerUseCase: GenerateRagAnswerUseCase,
  ) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const expectedDocumentIds = evaluationCase.expectedDocumentIds ?? [];

    const retrievalResult = await this.retriever.retrieve(evaluationCase.query);
    const retrievedDocumentIds = retrievalResult.documents.map(
      (retrievedDocument) => retrievedDocument.document.id,
    );
    const contextText = retrievalResult.documents
      .map((retrievedDocument) => retrievedDocument.document.text)
      .join("\n");

    const ragAnswer = await this.generateRagAnswerUseCase.execute(evaluationCase.query);
    const citationSourceIds = ragAnswer.citations.map((citation) => citation.sourceId);

    const contextCoverage = computeContextCoverage(expectedDocumentIds, retrievedDocumentIds);

    const claims = analyzeClaims(ragAnswer.answer, contextText);
    const groundedAnswerScore = computeGroundedAnswerScore(claims);
    const unsupportedClaimCount = computeUnsupportedClaimCount(claims);
    const unsupportedClaims = claims
      .filter((claim) => !claim.supported)
      .map((claim) => claim.claim);

    const citationCoverage = computeCitationCoverage(citationSourceIds, retrievedDocumentIds);

    const metrics: EvaluationMetric[] = [
      {
        name: CONTEXT_COVERAGE_METRIC_NAME,
        score: contextCoverage,
        passed: contextCoverage === PERFECT_SCORE,
        details: `${retrievedDocumentIds.length} document(s) retrieved as context`,
      },
      {
        name: GROUNDED_ANSWER_METRIC_NAME,
        score: groundedAnswerScore,
        passed: groundedAnswerScore === PERFECT_SCORE,
        details: `${claims.length - unsupportedClaimCount}/${claims.length} claim(s) grounded in retrieved context`,
      },
      {
        name: UNSUPPORTED_CLAIMS_METRIC_NAME,
        score: unsupportedClaimCount,
        passed: unsupportedClaimCount === NO_UNSUPPORTED_CLAIMS,
        details:
          unsupportedClaims.length > 0
            ? `unsupported: ${unsupportedClaims.join(" | ")}`
            : "no unsupported claims",
      },
      {
        name: CITATION_COVERAGE_METRIC_NAME,
        score: citationCoverage,
        passed: citationCoverage === PERFECT_SCORE,
        details: `${citationSourceIds.length} citation(s) checked against retrieved context`,
      },
    ];

    return {
      caseId: evaluationCase.id,
      target: "rag-answer",
      passed: metrics.every((metric) => metric.passed),
      metrics,
    };
  }

  async runMany(evaluationCases: EvaluationCase[]): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];
    for (const evaluationCase of evaluationCases) {
      results.push(await this.run(evaluationCase));
    }

    return summarize(results);
  }
}
