import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { GroundingMetricsReport } from "./GroundingMetricsReport";
import { GroundingMetricsEvaluationRunner } from "./GroundingMetricsEvaluationRunner";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";
import type { RetrievalMetricsReport } from "./RetrievalMetricsReport";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import {
  CITATION_COVERAGE_METRIC_NAME,
  CONTEXT_COVERAGE_METRIC_NAME,
  GROUNDED_ANSWER_METRIC_NAME,
  UNSUPPORTED_CLAIMS_METRIC_NAME,
} from "./GroundingMetricsEvaluationRunner";
import {
  HIT_RATE_METRIC_NAME,
  MRR_METRIC_NAME,
  RECALL_AT_1_METRIC_NAME,
  RECALL_AT_3_METRIC_NAME,
  RECALL_AT_5_METRIC_NAME,
} from "./RetrievalMetricsEvaluationRunner";
import {
  compareUnifiedEvaluationReports,
  formatUnifiedReportRegressionComparison,
  type MetricRegressionComparison,
  type MetricRegressionStatus,
  type UnifiedEvaluationReportMetricsView,
} from "./UnifiedReportRegressionComparator";
import { UnifiedEvaluationRunner } from "./UnifiedEvaluationRunner";

// Same literal marker LegalPromptBuilder.ts uses to switch between a
// grounded and an ungrounded prompt — reused here (not redefined), matching
// the convention already established across every prior Phase 25 grounding
// validation script.
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

/** Deterministic fake, identical in spirit to the one in runUnifiedEvaluationReportValidation.ts: echoes back exactly the retrieved article text embedded in the prompt when grounded, stays silent otherwise. */
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

function findComparison(
  comparisons: MetricRegressionComparison[],
  section: "retrieval" | "grounding",
  metricName: string,
): MetricRegressionComparison {
  const found = comparisons.find(
    (comparison) => comparison.section === section && comparison.metricName === metricName,
  );
  assertTruthy(found, `expected a comparison for ${section}/${metricName}`);
  return found!;
}

function assertStatus(
  comparisons: MetricRegressionComparison[],
  section: "retrieval" | "grounding",
  metricName: string,
  expected: MetricRegressionStatus,
): void {
  const comparison = findComparison(comparisons, section, metricName);
  assertEqual(comparison.status, expected, `${section}/${metricName} status mismatch`);
}

// -- Layer 1: hand-crafted, fully deterministic baseline/current report -----
// fixtures. Only the retrievalMetrics/groundingMetrics sections are needed
// (UnifiedEvaluationReportMetricsView) -- no failureAnalysis/datasetSummary/
// overallSummary fabrication required, since the comparator never reads them.

const BASELINE_RETRIEVAL: RetrievalMetricsReport = {
  datasetSize: 10,
  positiveCaseCount: 10,
  hitRate: 0.8,
  recallAt1: 0.5,
  recallAt3: 0.7,
  recallAt5: 0.8,
  mrr: 0.6,
};

// hitRate up 0.10 (improved), recallAt1 unchanged, recallAt3 down 0.10
// (regressed), recallAt5 up only 0.005 (within the default 0.01 threshold
// -> unchanged), mrr down 0.05 (regressed).
const CURRENT_RETRIEVAL_MIXED: RetrievalMetricsReport = {
  datasetSize: 10,
  positiveCaseCount: 10,
  hitRate: 0.9,
  recallAt1: 0.5,
  recallAt3: 0.6,
  recallAt5: 0.805,
  mrr: 0.55,
};

const BASELINE_GROUNDING: GroundingMetricsReport = {
  datasetSize: 10,
  positiveCaseCount: 10,
  averageContextCoverage: 0.9,
  averageGroundedAnswer: 1,
  totalUnsupportedClaims: 2,
  casesWithUnsupportedClaims: 2,
  averageCitationCoverage: 1,
};

// contextCoverage up 0.05 (improved), groundedAnswer unchanged,
// unsupportedClaims up 2 -> 5 (regressed: MORE unsupported claims is worse),
// citationCoverage unchanged.
const CURRENT_GROUNDING_MIXED: GroundingMetricsReport = {
  datasetSize: 10,
  positiveCaseCount: 10,
  averageContextCoverage: 0.95,
  averageGroundedAnswer: 1,
  totalUnsupportedClaims: 5,
  casesWithUnsupportedClaims: 4,
  averageCitationCoverage: 1,
};

const BASELINE_MIXED: UnifiedEvaluationReportMetricsView = {
  retrievalMetrics: BASELINE_RETRIEVAL,
  groundingMetrics: BASELINE_GROUNDING,
};
const CURRENT_MIXED: UnifiedEvaluationReportMetricsView = {
  retrievalMetrics: CURRENT_RETRIEVAL_MIXED,
  groundingMetrics: CURRENT_GROUNDING_MIXED,
};

async function validateMixedComparisonClassification(): Promise<void> {
  const comparison = compareUnifiedEvaluationReports(BASELINE_MIXED, CURRENT_MIXED);

  assertEqual(comparison.threshold, 0.01, "expected the default threshold when none is passed");
  assertEqual(comparison.metricComparisons.length, 9, "expected 5 retrieval + 4 grounding metric comparisons");

  assertStatus(comparison.metricComparisons, "retrieval", HIT_RATE_METRIC_NAME, "improved");
  assertStatus(comparison.metricComparisons, "retrieval", RECALL_AT_1_METRIC_NAME, "unchanged");
  assertStatus(comparison.metricComparisons, "retrieval", RECALL_AT_3_METRIC_NAME, "regressed");
  assertStatus(comparison.metricComparisons, "retrieval", RECALL_AT_5_METRIC_NAME, "unchanged");
  assertStatus(comparison.metricComparisons, "retrieval", MRR_METRIC_NAME, "regressed");

  assertStatus(comparison.metricComparisons, "grounding", CONTEXT_COVERAGE_METRIC_NAME, "improved");
  assertStatus(comparison.metricComparisons, "grounding", GROUNDED_ANSWER_METRIC_NAME, "unchanged");
  assertStatus(comparison.metricComparisons, "grounding", UNSUPPORTED_CLAIMS_METRIC_NAME, "regressed");
  assertStatus(comparison.metricComparisons, "grounding", CITATION_COVERAGE_METRIC_NAME, "unchanged");

  assertEqual(comparison.improvedCount, 2, "expected 2 improved metrics");
  assertEqual(comparison.unchangedCount, 4, "expected 4 unchanged metrics");
  assertEqual(comparison.regressedCount, 3, "expected 3 regressed metrics");
  assertEqual(
    comparison.improvedCount + comparison.unchangedCount + comparison.regressedCount,
    comparison.metricComparisons.length,
    "improved + unchanged + regressed must reconcile with the total comparison count",
  );
  assertTruthy(comparison.hasRegressions, "expected hasRegressions to be true when any metric regressed");

  const hitRateComparison = findComparison(comparison.metricComparisons, "retrieval", HIT_RATE_METRIC_NAME);
  assertTruthy(
    Math.abs(hitRateComparison.delta - 0.1) < 1e-9,
    "expected the signed delta to be current - baseline (+0.10 for hit rate)",
  );
  assertTruthy(
    Math.abs(hitRateComparison.absoluteDelta - Math.abs(hitRateComparison.delta)) < 1e-12,
    "absoluteDelta must be the magnitude of delta",
  );
}

// -- Layer 1b: the lower-is-better direction (Unsupported Claims) ----------

const IDENTICAL_RETRIEVAL: RetrievalMetricsReport = {
  datasetSize: 5,
  positiveCaseCount: 5,
  hitRate: 0.9,
  recallAt1: 0.6,
  recallAt3: 0.8,
  recallAt5: 0.9,
  mrr: 0.7,
};

const UNSUPPORTED_CLAIMS_BASELINE: GroundingMetricsReport = {
  datasetSize: 5,
  positiveCaseCount: 5,
  averageContextCoverage: 0.9,
  averageGroundedAnswer: 1,
  totalUnsupportedClaims: 5,
  casesWithUnsupportedClaims: 3,
  averageCitationCoverage: 1,
};

// Fewer unsupported claims than baseline -> an improvement, even though the
// raw delta is negative -- proves the lower-is-better inversion works.
const UNSUPPORTED_CLAIMS_IMPROVED: GroundingMetricsReport = {
  ...UNSUPPORTED_CLAIMS_BASELINE,
  totalUnsupportedClaims: 2,
  casesWithUnsupportedClaims: 1,
};

async function validateUnsupportedClaimsDirection(): Promise<void> {
  const comparison = compareUnifiedEvaluationReports(
    { retrievalMetrics: IDENTICAL_RETRIEVAL, groundingMetrics: UNSUPPORTED_CLAIMS_BASELINE },
    { retrievalMetrics: IDENTICAL_RETRIEVAL, groundingMetrics: UNSUPPORTED_CLAIMS_IMPROVED },
  );

  const unsupportedClaimsComparison = findComparison(
    comparison.metricComparisons,
    "grounding",
    UNSUPPORTED_CLAIMS_METRIC_NAME,
  );
  assertEqual(unsupportedClaimsComparison.delta, -3, "expected a negative raw delta (5 -> 2)");
  assertEqual(
    unsupportedClaimsComparison.status,
    "improved",
    "fewer unsupported claims than baseline must be classified as improved (lower is better)",
  );

  for (const metricName of [
    HIT_RATE_METRIC_NAME,
    RECALL_AT_1_METRIC_NAME,
    RECALL_AT_3_METRIC_NAME,
    RECALL_AT_5_METRIC_NAME,
    MRR_METRIC_NAME,
  ]) {
    assertStatus(comparison.metricComparisons, "retrieval", metricName, "unchanged");
  }
}

// -- Layer 1c: explicit regression thresholds --------------------------------

const THRESHOLD_BASELINE_RETRIEVAL: RetrievalMetricsReport = { ...IDENTICAL_RETRIEVAL, recallAt5: 0.8 };
const THRESHOLD_CURRENT_RETRIEVAL: RetrievalMetricsReport = { ...IDENTICAL_RETRIEVAL, recallAt5: 0.805 };

async function validateThresholdBehavior(): Promise<void> {
  const baseline: UnifiedEvaluationReportMetricsView = {
    retrievalMetrics: THRESHOLD_BASELINE_RETRIEVAL,
    groundingMetrics: UNSUPPORTED_CLAIMS_BASELINE,
  };
  const current: UnifiedEvaluationReportMetricsView = {
    retrievalMetrics: THRESHOLD_CURRENT_RETRIEVAL,
    groundingMetrics: UNSUPPORTED_CLAIMS_BASELINE,
  };

  // Same +0.005 delta, two different explicit thresholds -> two different verdicts.
  const wideThresholdComparison = compareUnifiedEvaluationReports(baseline, current, 0.01);
  assertStatus(wideThresholdComparison.metricComparisons, "retrieval", RECALL_AT_5_METRIC_NAME, "unchanged");

  const tightThresholdComparison = compareUnifiedEvaluationReports(baseline, current, 0.001);
  assertStatus(tightThresholdComparison.metricComparisons, "retrieval", RECALL_AT_5_METRIC_NAME, "improved");

  assertEqual(wideThresholdComparison.threshold, 0.01, "wide comparison should record the threshold passed in");
  assertEqual(tightThresholdComparison.threshold, 0.001, "tight comparison should record the threshold passed in");
}

async function validateFormatter(): Promise<void> {
  const comparison = compareUnifiedEvaluationReports(BASELINE_MIXED, CURRENT_MIXED);
  const formatted = formatUnifiedReportRegressionComparison(comparison);

  assertTruthy(formatted.includes("== Retrieval Metrics Regression =="), "missing retrieval regression section");
  assertTruthy(formatted.includes("== Grounding Metrics Regression =="), "missing grounding regression section");
  assertTruthy(formatted.includes("== Regression Summary =="), "missing regression summary section");
  assertTruthy(formatted.includes(HIT_RATE_METRIC_NAME), "missing a retrieval metric name in the formatted output");
  assertTruthy(
    formatted.includes(UNSUPPORTED_CLAIMS_METRIC_NAME),
    "missing a grounding metric name in the formatted output",
  );
  assertTruthy(formatted.includes("RESULT: REGRESSIONS DETECTED"), "expected the regression banner for the mixed fixture");
}

// -- Layer 2: two identical full unified reports through the real framework -
// (RAG_EVALUATION_DATASET + REAL_ARTICLE_DOCUMENTS, same deterministic Fake
// LLM both times) -- proves the comparator reports zero regressions/zero
// improvements for a genuinely stable baseline, not just hand fixtures.

function buildUnifiedRunner(): UnifiedEvaluationRunner {
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new EchoFakeLLMProvider(),
    ragAnswerBuilder,
  );
  const retrievalMetricsRunner = new RetrievalMetricsEvaluationRunner(retriever);
  const groundingMetricsRunner = new GroundingMetricsEvaluationRunner(retriever, generateRagAnswerUseCase);

  return new UnifiedEvaluationRunner(retriever, repository, retrievalMetricsRunner, groundingMetricsRunner);
}

async function validateFullFrameworkSelfConsistency(): Promise<void> {
  const baselineReport = await buildUnifiedRunner().run(RAG_EVALUATION_DATASET);
  const currentReport = await buildUnifiedRunner().run(RAG_EVALUATION_DATASET);

  const comparison = compareUnifiedEvaluationReports(baselineReport, currentReport);

  assertEqual(comparison.regressedCount, 0, "identical baseline/current runs must never report a regression");
  assertEqual(comparison.improvedCount, 0, "identical baseline/current runs must never report an improvement");
  assertEqual(
    comparison.unchangedCount,
    comparison.metricComparisons.length,
    "every metric must be classified unchanged for an identical baseline/current pair",
  );
  assertTruthy(!comparison.hasRegressions, "expected no regressions for an identical baseline/current pair");

  console.log("[evaluation] Unified report regression comparison (RAG_EVALUATION_DATASET, identical baseline/current):");
  console.log(formatUnifiedReportRegressionComparison(comparison));
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: retrieval runs against an in-memory KeywordRetriever with a deterministic Fake LLM -- no OpenSearch/Anthropic/OpenAI calls. This validates regression comparison only -- Runtime, Composition, Prompt, Retriever, SearchEngine, OpenSearch mapping, the AI Provider, and every existing evaluation metric's own computation are never modified.",
  );

  console.log("[evaluation] Checking mixed improved/unchanged/regressed classification against a hand-crafted baseline/current pair...");
  await validateMixedComparisonClassification();

  console.log("[evaluation] Checking the lower-is-better direction for Unsupported Claims...");
  await validateUnsupportedClaimsDirection();

  console.log("[evaluation] Checking explicit regression thresholds change classification for the same delta...");
  await validateThresholdBehavior();

  console.log("[evaluation] Checking the regression report formatter...");
  await validateFormatter();

  console.log("[evaluation] Running two identical full unified reports through the real framework and checking zero regressions...");
  await validateFullFrameworkSelfConsistency();

  console.log("Unified report regression validation succeeded.");
}

main();
