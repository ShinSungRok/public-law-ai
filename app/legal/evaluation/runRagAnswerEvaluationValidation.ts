import type { AIResponseStream } from "../../ai/model/AIResponse";
import type {
  LLMCompletionRequest,
  LLMProvider,
} from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { RagAnswerEvaluationRunner } from "./RagAnswerEvaluationRunner";

const GROUNDED_MARKER = "Retrieved legal context:";
const GROUNDED_ANSWER = "이 법은 개인정보를 보호합니다.";

const SAMPLE_DOCUMENTS: LegalDocument[] = [
  {
    id: "doc-a",
    documentType: "STATUTE_ARTICLE",
    title: "개인정보보호법",
    text: "개인정보의 처리와 보호에 관한 사항을 정한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "doc-a",
      sourceUrl: "https://fake.local/statutes/a",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: "doc-a" },
  },
];

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

/**
 * Mirrors real LLM behavior for validation purposes only: answers when the
 * prompt is grounded in retrieved context, and stays silent (empty answer)
 * when there is nothing retrieved to ground an answer in.
 */
class ContextAwareFakeLLMProvider implements LLMProvider {
  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const isGrounded = request.prompt.includes(GROUNDED_MARKER);
    return (async function* (): AIResponseStream {
      if (isGrounded) {
        yield { text: GROUNDED_ANSWER };
      }
    })();
  }
}

const GROUNDED_EXACT_CASE: EvaluationCase = {
  id: "rag-grounded-exact",
  name: "grounded answer with expected keyword and citation",
  target: "rag-answer",
  query: "개인정보보호법",
  expectedAnswerKeywords: ["개인정보"],
  expectedCitationDocumentIds: ["doc-a"],
};

const MISSING_KEYWORD_CASE: EvaluationCase = {
  id: "rag-missing-keyword",
  name: "grounded answer missing an expected keyword",
  target: "rag-answer",
  query: "개인정보보호법",
  expectedAnswerKeywords: ["존재하지않는키워드"],
};

const NO_RETRIEVAL_CASE: EvaluationCase = {
  id: "rag-no-retrieval",
  name: "no retrieval results yields empty answer and no citations",
  target: "rag-answer",
  query: "존재하지않는용어xyz",
  expectedCitationDocumentIds: ["doc-a"],
};

const SAMPLE_CASES: EvaluationCase[] = [
  GROUNDED_EXACT_CASE,
  MISSING_KEYWORD_CASE,
  NO_RETRIEVAL_CASE,
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function findMetric(result: { metrics: { name: string }[] }, name: string) {
  const metric = result.metrics.find((candidate) => candidate.name === name);
  if (!metric) {
    throw new Error(`metric not found: ${name}`);
  }
  return metric as { name: string; score: number; passed: boolean; details?: string };
}

async function main(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const llmProvider = new ContextAwareFakeLLMProvider();
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    llmProvider,
    ragAnswerBuilder,
  );
  const runner = new RagAnswerEvaluationRunner(generateRagAnswerUseCase);

  console.log("[evaluation] Checking answer generated successfully with expected keyword and citation...");
  const groundedResult = await runner.run(GROUNDED_EXACT_CASE);
  assertEqual(groundedResult.caseId, GROUNDED_EXACT_CASE.id, "grounded result caseId mismatch");
  assertEqual(groundedResult.target, "rag-answer", "grounded result target mismatch");
  assertTruthy(findMetric(groundedResult, "answer-not-empty").passed, "answer-not-empty should pass");
  assertTruthy(
    findMetric(groundedResult, "contains-expected-keywords").passed,
    "contains-expected-keywords should pass when keyword is present",
  );
  assertTruthy(findMetric(groundedResult, "citation-present").passed, "citation-present should pass");
  assertTruthy(
    findMetric(groundedResult, "expected-citation-document-present").passed,
    "expected-citation-document-present should pass",
  );
  assertTruthy(groundedResult.passed, "grounded case should pass overall");

  console.log("[evaluation] Checking missing expected keyword fails...");
  const missingKeywordResult = await runner.run(MISSING_KEYWORD_CASE);
  const missingKeywordMetric = findMetric(missingKeywordResult, "contains-expected-keywords");
  assertEqual(missingKeywordMetric.score, 0, "missing keyword metric score mismatch");
  assertTruthy(!missingKeywordMetric.passed, "contains-expected-keywords should fail when keyword is absent");
  assertTruthy(!missingKeywordResult.passed, "missing-keyword case should fail overall");
  assertTruthy(
    findMetric(missingKeywordResult, "answer-not-empty").passed,
    "answer-not-empty should still pass for the missing-keyword case",
  );

  console.log("[evaluation] Checking empty answer and missing citation fail when nothing is retrieved...");
  const noRetrievalResult = await runner.run(NO_RETRIEVAL_CASE);
  assertTruthy(
    !findMetric(noRetrievalResult, "answer-not-empty").passed,
    "answer-not-empty should fail when nothing is retrieved",
  );
  assertTruthy(
    !findMetric(noRetrievalResult, "citation-present").passed,
    "citation-present should fail when nothing is retrieved",
  );
  assertTruthy(
    !findMetric(noRetrievalResult, "expected-citation-document-present").passed,
    "expected-citation-document-present should fail when nothing is retrieved",
  );
  assertTruthy(!noRetrievalResult.passed, "no-retrieval case should fail overall");

  console.log("[evaluation] Checking RagAnswerEvaluationRunner aggregates an EvaluationSummary...");
  const summary = await runner.runMany(SAMPLE_CASES);
  assertEqual(summary.totalCount, SAMPLE_CASES.length, "summary totalCount mismatch");
  assertEqual(summary.results.length, SAMPLE_CASES.length, "summary results length mismatch");

  const expectedPassedCount = summary.results.filter((result) => result.passed).length;
  const expectedFailedCount = summary.results.filter((result) => !result.passed).length;
  assertEqual(summary.passedCount, expectedPassedCount, "summary passedCount mismatch");
  assertEqual(summary.failedCount, expectedFailedCount, "summary failedCount mismatch");
  assertEqual(
    summary.passedCount + summary.failedCount,
    summary.totalCount,
    "summary passedCount + failedCount must equal totalCount",
  );
  assertEqual(summary.passedCount, 1, "expected only the grounded-exact case to pass");
  assertEqual(summary.failedCount, 2, "expected the missing-keyword and no-retrieval cases to fail");

  console.log("RAG answer evaluation validation succeeded.");
}

main();
