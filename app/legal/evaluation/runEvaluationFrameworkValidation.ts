import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";
import type { EvaluationTarget } from "./EvaluationTarget";

const EVALUATION_TARGETS: EvaluationTarget[] = [
  "retrieval",
  "search",
  "rag-answer",
  "citation",
  "regression",
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

class InMemoryEvaluationRunner implements EvaluationRunner {
  constructor(private readonly resultsByCaseId: Map<string, EvaluationResult>) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const result = this.resultsByCaseId.get(evaluationCase.id);
    if (!result) {
      throw new Error(`no in-memory result configured for case: ${evaluationCase.id}`);
    }
    return result;
  }
}

async function main(): Promise<void> {
  console.log("[evaluation] Checking evaluation target values exist...");
  assertEqual(
    EVALUATION_TARGETS.length,
    5,
    "expected exactly five evaluation targets",
  );
  for (const target of EVALUATION_TARGETS) {
    assertTruthy(target, "evaluation target must be a non-empty value");
  }

  console.log(
    "[evaluation] Checking evaluation case structure supports every target...",
  );
  const sampleCases: EvaluationCase[] = EVALUATION_TARGETS.map((target, index) => ({
    id: `case-${index + 1}`,
    name: `${target} sample case`,
    target,
    query: "개인정보 보호",
    expectedDocumentIds: ["fake-statute-article-1"],
    expectedAnswerKeywords: ["개인정보"],
    expectedCitationDocumentIds: ["fake-statute-article-1"],
    metadata: { source: "structural-validation" },
  }));

  for (const evaluationCase of sampleCases) {
    assertTruthy(evaluationCase.id, "evaluation case missing id");
    assertTruthy(evaluationCase.name, "evaluation case missing name");
    assertTruthy(evaluationCase.query, "evaluation case missing query");
    assertTruthy(
      EVALUATION_TARGETS.includes(evaluationCase.target),
      `evaluation case target is not a known evaluation target: ${evaluationCase.target}`,
    );
  }

  const minimalCase: EvaluationCase = {
    id: "case-minimal",
    name: "minimal case without optional fields",
    target: "regression",
    query: "unused",
  };
  assertEqual(
    minimalCase.expectedDocumentIds,
    undefined,
    "optional fields on EvaluationCase must remain optional",
  );

  console.log(
    "[evaluation] Checking evaluation metrics can represent pass/fail and score...",
  );
  const passingMetric: EvaluationMetric = {
    name: "recall@k",
    score: 1,
    passed: true,
    details: "all expected documents retrieved",
  };
  const failingMetric: EvaluationMetric = {
    name: "precision@k",
    score: 0,
    passed: false,
  };
  assertTruthy(passingMetric.passed, "passing metric should be marked passed");
  assertTruthy(!failingMetric.passed, "failing metric should be marked not passed");
  assertTruthy(
    typeof passingMetric.score === "number" && typeof failingMetric.score === "number",
    "metric score must be numeric",
  );

  console.log("[evaluation] Checking evaluation results can aggregate metrics...");
  const results: EvaluationResult[] = sampleCases.map((evaluationCase, index) => {
    const passed = index % 2 === 0;
    return {
      caseId: evaluationCase.id,
      target: evaluationCase.target,
      passed,
      metrics: passed ? [passingMetric] : [passingMetric, failingMetric],
      details: passed ? undefined : "one metric failed",
    };
  });

  for (const result of results) {
    assertTruthy(result.caseId, "evaluation result missing caseId");
    assertTruthy(
      EVALUATION_TARGETS.includes(result.target),
      `evaluation result target is not a known evaluation target: ${result.target}`,
    );
    assertTruthy(
      result.metrics.length > 0,
      `evaluation result ${result.caseId} did not aggregate any metrics`,
    );
  }

  console.log(
    "[evaluation] Checking evaluation summary counts passed/failed cases correctly...",
  );
  const passedCount = results.filter((result) => result.passed).length;
  const failedCount = results.filter((result) => !result.passed).length;
  const summary: EvaluationSummary = {
    totalCount: results.length,
    passedCount,
    failedCount,
    results,
  };

  assertEqual(summary.totalCount, results.length, "summary totalCount mismatch");
  assertEqual(summary.passedCount, passedCount, "summary passedCount mismatch");
  assertEqual(summary.failedCount, failedCount, "summary failedCount mismatch");
  assertEqual(
    summary.passedCount + summary.failedCount,
    summary.totalCount,
    "summary passedCount + failedCount must equal totalCount",
  );

  console.log(
    "[evaluation] Checking EvaluationRunner contract works with in-memory data only...",
  );
  const runner: EvaluationRunner = new InMemoryEvaluationRunner(
    new Map(results.map((result) => [result.caseId, result])),
  );

  for (const evaluationCase of sampleCases) {
    const result = await runner.run(evaluationCase);
    assertEqual(
      result.caseId,
      evaluationCase.id,
      "runner returned a result with a mismatched caseId",
    );
  }

  console.log("Evaluation framework validation succeeded.");
}

main();
