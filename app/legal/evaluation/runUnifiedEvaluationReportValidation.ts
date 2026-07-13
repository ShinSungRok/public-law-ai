import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { GroundingMetricsEvaluationRunner } from "./GroundingMetricsEvaluationRunner";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS, toFixtureDocument } from "./RealArticleFixtures";
import { analyzeRetrievalFailures } from "./RetrievalFailureAnalyzer";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import {
  buildUnifiedEvaluationReport,
  formatUnifiedEvaluationReport,
} from "./UnifiedEvaluationReport";
import { UnifiedEvaluationRunner } from "./UnifiedEvaluationRunner";

// Same literal marker LegalPromptBuilder.ts uses to switch between a
// grounded and an ungrounded prompt — reused here (not redefined), matching
// the convention already established in runRagGroundingValidation.ts,
// runRagAnswerEvaluationValidation.ts, and runGroundingMetricsValidation.ts.
const GROUNDED_MARKER = "Retrieved legal context:";
const RETRIEVED_TEXT_LINE_PATTERN = /^Text: (.+)$/gm;

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
 * Deterministic fake, identical in spirit to GroundedEchoFakeLLMProvider in
 * runGroundingMetricsValidation.ts: echoes back exactly the retrieved
 * article text embedded in the prompt when grounded, stays silent
 * otherwise. This validation is about report composition, not grounding
 * accuracy (already validated by Task 4), so no unsupported-claim injection
 * option is needed here.
 */
class EchoFakeLLMProvider implements LLMProvider {
  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const isGrounded = request.prompt.includes(GROUNDED_MARKER);
    const retrievedTextLines = [...request.prompt.matchAll(RETRIEVED_TEXT_LINE_PATTERN)].map(
      (match) => match[1],
    );

    return (async function* (): AIResponseStream {
      if (!isGrounded) {
        return;
      }
      yield { text: retrievedTextLines.join(" ") };
    })();
  }
}

// -- Layer 1: hand-crafted fixtures exercising all three sections -----------

const FIXTURE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument("doc-a", "개인정보 정의", "개인정보란 살아 있는 개인에 관한 정보를 말한다."),
  toFixtureDocument("doc-b", "정보주체 권리", "정보주체는 개인정보 열람을 요구할 권리가 있다."),
];

// Retrieved and expected -> retrieval success, grounded answer.
const HIT_CASE: EvaluationCase = {
  id: "unified-fixture-hit",
  name: "expected document retrieved",
  target: "retrieval",
  query: "개인정보 정의",
  expectedDocumentIds: ["doc-a"],
};

// doc-x does not exist in the corpus at all -> a failure classified as
// missing-indexed-content by analyzeRetrievalFailures.
const MISS_CASE: EvaluationCase = {
  id: "unified-fixture-miss",
  name: "expected document missing from corpus",
  target: "retrieval",
  query: "존재하지않는용어",
  expectedDocumentIds: ["doc-x"],
};

// Out of domain: nothing expected, nothing retrieved.
const NEGATIVE_CASE: EvaluationCase = {
  id: "unified-fixture-negative",
  name: "out of domain",
  target: "retrieval",
  query: "완전히 다른 도메인",
  expectedDocumentIds: [],
};

const FIXTURE_CASES: EvaluationCase[] = [HIT_CASE, MISS_CASE, NEGATIVE_CASE];

function buildFixtureDependencies() {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new EchoFakeLLMProvider(),
    ragAnswerBuilder,
  );
  const retrievalMetricsRunner = new RetrievalMetricsEvaluationRunner(retriever);
  const groundingMetricsRunner = new GroundingMetricsEvaluationRunner(
    retriever,
    generateRagAnswerUseCase,
  );

  return { repository, retriever, retrievalMetricsRunner, groundingMetricsRunner };
}

async function validateUnifiedReportComposition(): Promise<void> {
  const { repository, retriever, retrievalMetricsRunner, groundingMetricsRunner } =
    buildFixtureDependencies();
  const unifiedRunner = new UnifiedEvaluationRunner(
    retriever,
    repository,
    retrievalMetricsRunner,
    groundingMetricsRunner,
  );

  const report = await unifiedRunner.run(FIXTURE_CASES);

  console.log("[evaluation] Checking UnifiedEvaluationRunner's output exactly matches buildUnifiedEvaluationReport composed from the same underlying evaluator output (no duplicated/divergent logic)...");
  const retrievalSummary = await retrievalMetricsRunner.runMany(FIXTURE_CASES);
  const failureAnalyses = await analyzeRetrievalFailures(FIXTURE_CASES, retriever, repository);
  const groundingSummary = await groundingMetricsRunner.runMany(FIXTURE_CASES);
  const expectedReport = buildUnifiedEvaluationReport(
    FIXTURE_CASES,
    retrievalSummary,
    failureAnalyses,
    groundingSummary,
  );
  assertEqual(
    JSON.stringify(report),
    JSON.stringify(expectedReport),
    "UnifiedEvaluationRunner.run() must produce exactly what buildUnifiedEvaluationReport produces from the same evaluator output",
  );

  console.log("[evaluation] Checking the Dataset Summary section...");
  assertEqual(report.datasetSummary.totalCases, 3, "dataset summary totalCases mismatch");
  assertEqual(report.datasetSummary.positiveCaseCount, 2, "expected hit + miss cases to have expected documents");
  assertEqual(report.datasetSummary.negativeCaseCount, 1, "expected only the negative case to have none");

  console.log("[evaluation] Checking the Retrieval Metrics section...");
  assertEqual(report.retrievalMetrics.datasetSize, 3, "retrieval metrics datasetSize mismatch");
  assertEqual(report.retrievalMetrics.positiveCaseCount, 2, "retrieval metrics positiveCaseCount mismatch");
  assertTruthy(report.retrievalMetrics.hitRate < 1, "expected an imperfect hit rate since doc-x is never retrievable");

  console.log("[evaluation] Checking the Failure Analysis section...");
  assertEqual(report.failureAnalysis.applicableCaseCount, 2, "failure analysis applicableCaseCount mismatch");
  assertEqual(report.failureAnalysis.successCount, 1, "expected only the hit case to succeed");
  assertEqual(report.failureAnalysis.failureCount, 1, "expected only the miss case to fail");
  const missingContentCount =
    report.failureAnalysis.failureCategoryCounts.find(
      (entry) => entry.category === "missing-indexed-content",
    )?.count ?? 0;
  assertEqual(missingContentCount, 1, "expected the doc-x miss to be classified as missing-indexed-content");

  console.log("[evaluation] Checking the Grounding Metrics section...");
  assertEqual(report.groundingMetrics.datasetSize, 3, "grounding metrics datasetSize mismatch");
  assertEqual(report.groundingMetrics.averageGroundedAnswer, 1, "echoed answers are grounded by construction");

  console.log("[evaluation] Checking the Overall Summary section...");
  assertEqual(
    report.overallSummary.totalEvaluations,
    retrievalSummary.totalCount + groundingSummary.totalCount,
    "overall totalEvaluations must equal retrieval + grounding evaluation counts",
  );
  assertEqual(report.overallSummary.totalEvaluations, 6, "expected 3 retrieval + 3 grounding evaluations");
  assertEqual(
    report.overallSummary.totalPassed + report.overallSummary.totalFailed,
    report.overallSummary.totalEvaluations,
    "overall passed + failed must reconcile with totalEvaluations",
  );
  assertTruthy(
    report.overallSummary.overallPassRate >= 0 && report.overallSummary.overallPassRate <= 1,
    "overall pass rate must be within [0, 1]",
  );

  console.log("[evaluation] Checking the formatted report includes every required section header...");
  const formatted = formatUnifiedEvaluationReport(report);
  assertTruthy(formatted.includes("UNIFIED EVALUATION REPORT"), "missing report title");
  assertTruthy(formatted.includes("== Dataset Summary =="), "missing Dataset Summary section");
  assertTruthy(formatted.includes("== Retrieval Metrics =="), "missing Retrieval Metrics section");
  assertTruthy(formatted.includes("== Failure Analysis =="), "missing Failure Analysis section");
  assertTruthy(formatted.includes("== Grounding Metrics =="), "missing Grounding Metrics section");
  assertTruthy(formatted.includes("== Overall Summary =="), "missing Overall Summary section");
}

// -- Layer 2: full RAG_EVALUATION_DATASET unified report against real -------
// article text (REAL_ARTICLE_DOCUMENTS — the same corpus already reused by
// every prior Phase 25 validation script).

async function validateFullDatasetUnifiedReport(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new EchoFakeLLMProvider(),
    ragAnswerBuilder,
  );
  const retrievalMetricsRunner = new RetrievalMetricsEvaluationRunner(retriever);
  const groundingMetricsRunner = new GroundingMetricsEvaluationRunner(
    retriever,
    generateRagAnswerUseCase,
  );
  const unifiedRunner = new UnifiedEvaluationRunner(
    retriever,
    repository,
    retrievalMetricsRunner,
    groundingMetricsRunner,
  );

  const report = await unifiedRunner.run(RAG_EVALUATION_DATASET);

  assertEqual(report.datasetSummary.totalCases, RAG_EVALUATION_DATASET.length, "dataset summary size mismatch");
  assertEqual(report.retrievalMetrics.datasetSize, RAG_EVALUATION_DATASET.length, "retrieval metrics size mismatch");
  assertEqual(report.failureAnalysis.datasetSize, RAG_EVALUATION_DATASET.length, "failure analysis size mismatch");
  assertEqual(report.groundingMetrics.datasetSize, RAG_EVALUATION_DATASET.length, "grounding metrics size mismatch");
  assertEqual(
    report.overallSummary.totalEvaluations,
    RAG_EVALUATION_DATASET.length * 2,
    "expected 2 evaluations (retrieval + grounding) per dataset case",
  );

  console.log("[evaluation] Unified evaluation report (RAG_EVALUATION_DATASET, in-memory KeywordRetriever):");
  console.log(formatUnifiedEvaluationReport(report));
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: retrieval runs against an in-memory KeywordRetriever with a deterministic Fake LLM -- no OpenSearch/Anthropic/OpenAI calls. This validates report composition only -- Runtime, Composition, Prompt, Retriever, SearchEngine, OpenSearch mapping, and the AI Provider are never modified.",
  );

  console.log("[evaluation] Checking unified report composition against a small hand-crafted fixture...");
  await validateUnifiedReportComposition();

  console.log("[evaluation] Running the full RAG_EVALUATION_DATASET unified report against real article text...");
  await validateFullDatasetUnifiedReport();

  console.log("Unified evaluation report validation succeeded.");
}

main();
