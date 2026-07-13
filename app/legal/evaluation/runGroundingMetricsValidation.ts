import type { AIResponseStream } from "../../ai/model/AIResponse";
import type { LLMCompletionRequest, LLMProvider } from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { computeClaimOverlapRatio, analyzeClaims } from "./GroundingAnalyzer";
import {
  computeCitationCoverage,
  computeContextCoverage,
  computeGroundedAnswerScore,
  computeUnsupportedClaimCount,
} from "./GroundingMetricsCalculator";
import {
  CITATION_COVERAGE_METRIC_NAME,
  CONTEXT_COVERAGE_METRIC_NAME,
  GROUNDED_ANSWER_METRIC_NAME,
  GroundingMetricsEvaluationRunner,
  UNSUPPORTED_CLAIMS_METRIC_NAME,
} from "./GroundingMetricsEvaluationRunner";
import { buildGroundingMetricsReport, formatGroundingMetricsReport } from "./GroundingMetricsReport";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS, toFixtureDocument } from "./RealArticleFixtures";

// Same literal marker LegalPromptBuilder.ts uses to switch between a
// grounded and an ungrounded prompt — reused here (not redefined) so this
// validation breaks if that existing contract ever changes. Mirrors the
// convention already established in runRagGroundingValidation.ts and
// runRagAnswerEvaluationValidation.ts.
const GROUNDED_MARKER = "Retrieved legal context:";
const RETRIEVED_TEXT_LINE_PATTERN = /^Text: (.+)$/gm;

// Deliberately unrelated vocabulary (Antarctic penguin patrols) so this
// fabricated sentence shares no tokens with any 개인정보 보호법 statute
// text in the fixtures below, guaranteeing it is detected as unsupported.
const FABRICATED_SENTENCE = "남극 펭귄 보호구역은 매년 겨울마다 순찰한다.";

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
 * Deterministic fake: when the prompt is grounded, echoes back exactly the
 * retrieved article text embedded in the prompt (extracted from the
 * existing `Text: ...` lines LegalPromptBuilder.ts already produces per
 * document) — guaranteeing every claim is a verbatim excerpt of the
 * retrieved context. Optionally appends one fabricated, vocabulary-disjoint
 * sentence to exercise unsupported-claim detection. Stays silent when
 * ungrounded, matching the existing insufficient-context contract.
 */
class GroundedEchoFakeLLMProvider implements LLMProvider {
  constructor(private readonly injectUnsupportedClaim: boolean = false) {}

  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const isGrounded = request.prompt.includes(GROUNDED_MARKER);
    const retrievedTextLines = [...request.prompt.matchAll(RETRIEVED_TEXT_LINE_PATTERN)].map(
      (match) => match[1],
    );
    const injectUnsupportedClaim = this.injectUnsupportedClaim;

    return (async function* (): AIResponseStream {
      if (!isGrounded) {
        return;
      }
      let answer = retrievedTextLines.join(" ");
      if (injectUnsupportedClaim) {
        answer += ` ${FABRICATED_SENTENCE}`;
      }
      yield { text: answer };
    })();
  }
}

// -- Layer 1: hand-crafted fixtures for the claim/metric math ---------------

const FIXTURE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument("doc-a", "개인정보 정의", "개인정보란 살아 있는 개인에 관한 정보를 말한다."),
];

const GROUNDED_CASE: EvaluationCase = {
  id: "grounding-fixture-grounded",
  name: "fully grounded answer",
  target: "rag-answer",
  query: "개인정보 정의",
  expectedDocumentIds: ["doc-a"],
};

const NO_RETRIEVAL_CASE: EvaluationCase = {
  id: "grounding-fixture-no-retrieval",
  name: "no retrieval results yields vacuous grounding but failed context coverage",
  target: "rag-answer",
  query: "존재하지않는용어xyz",
  expectedDocumentIds: ["doc-a"],
};

const NEGATIVE_CASE: EvaluationCase = {
  id: "grounding-fixture-negative",
  name: "out of domain (no expected context)",
  target: "rag-answer",
  query: "완전히 다른 도메인",
  expectedDocumentIds: [],
};

async function validateClaimAnalysisMath(): Promise<void> {
  assertEqual(
    computeClaimOverlapRatio("개인정보란 정보다", "개인정보란 정보를 보호하는 정보다"),
    1,
    "fully overlapping claim should score 1",
  );
  assertEqual(
    computeClaimOverlapRatio("개인정보란 우주선이다", "개인정보란 정보를 보호하는 정보다"),
    0.5,
    "half-overlapping claim (1 of 2 tokens found) should score 0.5",
  );
  assertEqual(
    computeClaimOverlapRatio("", "아무 맥락"),
    1,
    "an empty claim has nothing to check -> vacuous 1",
  );

  const claims = analyzeClaims(
    "개인정보란 정보다. 완전 다른 문장 우주선.",
    "개인정보란 정보다",
  );
  assertEqual(claims.length, 2, "expected two sentence-level claims");
  assertTruthy(claims[0].supported, "first claim is a verbatim excerpt of the context -> supported");
  assertTruthy(!claims[1].supported, "second claim shares no vocabulary with the context -> unsupported");
}

async function validateCalculatorFunctions(): Promise<void> {
  assertEqual(computeContextCoverage(["doc-a"], ["doc-a", "doc-b"]), 1, "expected doc present in retrieved context");
  assertEqual(computeContextCoverage(["doc-a"], ["doc-b"]), 0, "expected doc absent from retrieved context");
  assertEqual(computeContextCoverage([], []), 1, "vacuous: nothing expected");

  assertEqual(computeGroundedAnswerScore([]), 1, "vacuous: no claims to ground");
  assertEqual(
    computeGroundedAnswerScore([
      { claim: "a", overlapRatio: 1, supported: true },
      { claim: "b", overlapRatio: 0, supported: false },
    ]),
    0.5,
    "half the claims supported -> 0.5",
  );

  assertEqual(
    computeUnsupportedClaimCount([
      { claim: "a", overlapRatio: 1, supported: true },
      { claim: "b", overlapRatio: 0, supported: false },
    ]),
    1,
    "expected exactly one unsupported claim",
  );

  assertEqual(computeCitationCoverage([], []), 1, "vacuous: no citations to check");
  assertEqual(computeCitationCoverage(["doc-a"], ["doc-a"]), 1, "citation points at retrieved document");
  assertEqual(
    computeCitationCoverage(["doc-a", "doc-x"], ["doc-a"]),
    0.5,
    "one of two citations points outside retrieved context",
  );
}

async function validateGroundingMetricsEvaluationRunner(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());

  const groundedUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new GroundedEchoFakeLLMProvider(false),
    ragAnswerBuilder,
  );
  const groundedRunner = new GroundingMetricsEvaluationRunner(retriever, groundedUseCase);

  console.log("[evaluation] Checking a fully grounded answer passes all four grounding metrics...");
  const groundedResult = await groundedRunner.run(GROUNDED_CASE);
  assertEqual(groundedResult.target, "rag-answer", "grounding result target mismatch");
  assertTruthy(groundedResult.passed, "fully grounded case should pass overall");
  const groundedMetrics = Object.fromEntries(groundedResult.metrics.map((m) => [m.name, m.score]));
  assertEqual(groundedMetrics[CONTEXT_COVERAGE_METRIC_NAME], 1, "context coverage mismatch");
  assertEqual(groundedMetrics[GROUNDED_ANSWER_METRIC_NAME], 1, "grounded-answer score mismatch");
  assertEqual(groundedMetrics[UNSUPPORTED_CLAIMS_METRIC_NAME], 0, "unsupported-claims count mismatch");
  assertEqual(groundedMetrics[CITATION_COVERAGE_METRIC_NAME], 1, "citation coverage mismatch");

  console.log("[evaluation] Checking a fabricated (unsupported) claim is detected and fails the case...");
  const unsupportedUseCase = new GenerateRagAnswerUseCase(
    retriever,
    new GroundedEchoFakeLLMProvider(true),
    ragAnswerBuilder,
  );
  const unsupportedRunner = new GroundingMetricsEvaluationRunner(retriever, unsupportedUseCase);
  const unsupportedResult = await unsupportedRunner.run(GROUNDED_CASE);
  assertTruthy(!unsupportedResult.passed, "case with a fabricated claim should fail overall");
  const unsupportedMetrics = Object.fromEntries(unsupportedResult.metrics.map((m) => [m.name, m.score]));
  assertEqual(
    unsupportedMetrics[UNSUPPORTED_CLAIMS_METRIC_NAME],
    1,
    "expected exactly the one fabricated sentence to be flagged",
  );
  assertTruthy(
    (unsupportedMetrics[GROUNDED_ANSWER_METRIC_NAME] as number) < 1,
    "grounded-answer score should drop below perfect when a claim is fabricated",
  );
  assertEqual(
    unsupportedMetrics[CONTEXT_COVERAGE_METRIC_NAME],
    1,
    "context coverage depends only on retrieval, not answer content",
  );
  assertEqual(
    unsupportedMetrics[CITATION_COVERAGE_METRIC_NAME],
    1,
    "citations are built from retrieved documents regardless of answer content",
  );

  console.log("[evaluation] Checking no-retrieval yields failed context coverage but vacuous grounding...");
  const noRetrievalResult = await groundedRunner.run(NO_RETRIEVAL_CASE);
  assertTruthy(!noRetrievalResult.passed, "no-retrieval case should fail overall (context coverage = 0)");
  const noRetrievalMetrics = Object.fromEntries(noRetrievalResult.metrics.map((m) => [m.name, m.score]));
  assertEqual(
    noRetrievalMetrics[CONTEXT_COVERAGE_METRIC_NAME],
    0,
    "expected document was never retrieved as context",
  );
  assertEqual(
    noRetrievalMetrics[GROUNDED_ANSWER_METRIC_NAME],
    1,
    "vacuous: an empty answer has no claims to ground",
  );
  assertEqual(noRetrievalMetrics[CITATION_COVERAGE_METRIC_NAME], 1, "vacuous: no citations to check");

  console.log("[evaluation] Checking an out-of-domain case trivially passes (nothing expected, nothing retrieved)...");
  const negativeResult = await groundedRunner.run(NEGATIVE_CASE);
  assertTruthy(negativeResult.passed, "negative case should trivially pass");

  console.log("[evaluation] Checking GroundingMetricsEvaluationRunner aggregates an EvaluationSummary...");
  const summary = await groundedRunner.runMany([GROUNDED_CASE, NO_RETRIEVAL_CASE, NEGATIVE_CASE]);
  assertEqual(summary.totalCount, 3, "summary totalCount mismatch");
  assertEqual(summary.passedCount, 2, "expected grounded + negative cases to pass, no-retrieval to fail");
  assertEqual(summary.failedCount, 1, "expected exactly one failing case");
}

async function validateReportAggregation(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(
    retriever,
    new GroundedEchoFakeLLMProvider(false),
    ragAnswerBuilder,
  );
  const runner = new GroundingMetricsEvaluationRunner(retriever, useCase);

  const cases = [GROUNDED_CASE, NO_RETRIEVAL_CASE, NEGATIVE_CASE];
  const results = [];
  for (const evaluationCase of cases) {
    results.push(await runner.run(evaluationCase));
  }

  const report = buildGroundingMetricsReport(cases, results);
  assertEqual(report.datasetSize, 3, "report datasetSize mismatch");
  assertEqual(report.positiveCaseCount, 2, "expected negative case excluded from positiveCaseCount");
  // Context coverage over the two positive cases: grounded=1, no-retrieval=0 -> average 0.5.
  assertEqual(report.averageContextCoverage, 0.5, "aggregate context coverage mismatch");
  // Grounded answer over all three cases: grounded=1, no-retrieval=1 (vacuous), negative=1 (vacuous) -> 1.
  assertEqual(report.averageGroundedAnswer, 1, "aggregate grounded-answer mismatch");
  assertEqual(report.totalUnsupportedClaims, 0, "expected no unsupported claims in this fixture set");
  assertEqual(report.casesWithUnsupportedClaims, 0, "expected no cases with unsupported claims");
  assertEqual(report.averageCitationCoverage, 1, "aggregate citation coverage mismatch");

  const formatted = formatGroundingMetricsReport(report);
  assertTruthy(formatted.includes("Dataset: 3"), "formatted report missing dataset size line");
  assertTruthy(formatted.includes("Context Coverage: 50%"), "formatted report missing context coverage line");
  assertTruthy(formatted.includes("Grounded Answer: 100%"), "formatted report missing grounded answer line");
}

// -- Layer 2: full RAG_EVALUATION_DATASET grounding report against real -----
// article text (REAL_ARTICLE_DOCUMENTS — the same corpus already reused by
// runRetrievalMetricsValidation.ts and runRetrievalFailureAnalysisValidation.ts).

async function validateFullDatasetGroundingReport(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(
    retriever,
    new GroundedEchoFakeLLMProvider(false),
    ragAnswerBuilder,
  );
  const runner = new GroundingMetricsEvaluationRunner(retriever, useCase);

  const summary = await runner.runMany(RAG_EVALUATION_DATASET);
  assertEqual(summary.totalCount, RAG_EVALUATION_DATASET.length, "expected one result per dataset case");

  // The fake LLM only ever echoes verbatim excerpts of the retrieved
  // context, so every case's answer must be fully grounded by construction
  // — this proves the metric computation is correct end-to-end against real
  // statute text, not just the small hand-crafted fixtures above.
  for (const result of summary.results) {
    const metrics = Object.fromEntries(result.metrics.map((m) => [m.name, m.score]));
    assertEqual(
      metrics[GROUNDED_ANSWER_METRIC_NAME],
      1,
      `expected a fully grounded answer for case ${result.caseId}`,
    );
    assertEqual(
      metrics[UNSUPPORTED_CLAIMS_METRIC_NAME],
      0,
      `expected no unsupported claims for case ${result.caseId}`,
    );
    assertEqual(
      metrics[CITATION_COVERAGE_METRIC_NAME],
      1,
      `expected full citation coverage for case ${result.caseId}`,
    );
  }

  const report = buildGroundingMetricsReport(RAG_EVALUATION_DATASET, summary.results);
  assertEqual(report.datasetSize, RAG_EVALUATION_DATASET.length, "report datasetSize mismatch");
  const expectedPositiveCount = RAG_EVALUATION_DATASET.filter(
    (evaluationCase) => (evaluationCase.expectedDocumentIds?.length ?? 0) > 0,
  ).length;
  assertEqual(report.positiveCaseCount, expectedPositiveCount, "report positiveCaseCount mismatch");
  assertEqual(report.averageGroundedAnswer, 1, "every echoed answer is grounded by construction");
  assertEqual(report.totalUnsupportedClaims, 0, "expected zero unsupported claims across the whole dataset");
  assertEqual(report.casesWithUnsupportedClaims, 0, "expected zero cases with unsupported claims");
  assertEqual(report.averageCitationCoverage, 1, "citations are always built from retrieved documents");
  assertTruthy(
    report.averageContextCoverage >= 0 && report.averageContextCoverage <= 1,
    "context coverage must be within [0, 1]",
  );

  console.log("[evaluation] Grounding summary report (RAG_EVALUATION_DATASET, in-memory KeywordRetriever):");
  console.log(formatGroundingMetricsReport(report));
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: retrieval runs against an in-memory KeywordRetriever with a deterministic Fake LLM -- no OpenSearch/Anthropic/OpenAI calls. Grounding measurement only -- Retriever, SearchEngine, Prompt, and AI Provider are never modified.",
  );

  console.log("[evaluation] Checking claim overlap/classification math against hand-computed values...");
  await validateClaimAnalysisMath();

  console.log("[evaluation] Checking grounding metric calculator math against hand-computed values...");
  await validateCalculatorFunctions();

  console.log("[evaluation] Checking GroundingMetricsEvaluationRunner produces correct per-case metrics...");
  await validateGroundingMetricsEvaluationRunner();

  console.log("[evaluation] Checking the aggregate grounding report...");
  await validateReportAggregation();

  console.log("[evaluation] Running the full RAG_EVALUATION_DATASET grounding report against real article text...");
  await validateFullDatasetGroundingReport();

  console.log("Grounding metrics validation succeeded.");
}

main();
