import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationSummary } from "./EvaluationSummary";
import {
  buildGroundingMetricsReport,
  formatGroundingMetricsReport,
  type GroundingMetricsReport,
} from "./GroundingMetricsReport";
import type { RetrievalCaseAnalysis } from "./RetrievalFailureAnalyzer";
import {
  buildRetrievalFailureReport,
  formatRetrievalFailureReport,
  type RetrievalFailureReport,
} from "./RetrievalFailureReport";
import {
  buildRetrievalMetricsReport,
  formatRetrievalMetricsReport,
  type RetrievalMetricsReport,
} from "./RetrievalMetricsReport";

export interface UnifiedEvaluationDatasetSummary {
  totalCases: number;
  /** Cases with at least one expected document — reused from RetrievalMetricsReport.positiveCaseCount, not recomputed. */
  positiveCaseCount: number;
  negativeCaseCount: number;
}

export interface UnifiedEvaluationOverallSummary {
  /** retrievalSummary.totalCount + groundingSummary.totalCount — two evaluations (retrieval quality, grounding quality) per case. */
  totalEvaluations: number;
  totalPassed: number;
  totalFailed: number;
  overallPassRate: number;
}

export interface UnifiedEvaluationReport {
  datasetSummary: UnifiedEvaluationDatasetSummary;
  retrievalMetrics: RetrievalMetricsReport;
  failureAnalysis: RetrievalFailureReport;
  groundingMetrics: GroundingMetricsReport;
  overallSummary: UnifiedEvaluationOverallSummary;
}

/**
 * Aggregates the three existing, independently-computed evaluation reports —
 * Retrieval Metrics (Task 2's `buildRetrievalMetricsReport`), Failure
 * Analysis (Task 3's `buildRetrievalFailureReport`), Grounding Metrics
 * (Task 4's `buildGroundingMetricsReport`) — plus a Dataset Summary and an
 * Overall Summary into a single unified report. Every section's actual
 * computation is delegated to the builder that already owns it; this
 * function adds no new scoring logic, only composition of results the
 * caller already produced by running the existing evaluators (see
 * `UnifiedEvaluationRunner`).
 */
export function buildUnifiedEvaluationReport(
  cases: EvaluationCase[],
  retrievalSummary: EvaluationSummary,
  failureAnalyses: RetrievalCaseAnalysis[],
  groundingSummary: EvaluationSummary,
): UnifiedEvaluationReport {
  const retrievalMetrics = buildRetrievalMetricsReport(cases, retrievalSummary.results);
  const failureAnalysis = buildRetrievalFailureReport(failureAnalyses);
  const groundingMetrics = buildGroundingMetricsReport(cases, groundingSummary.results);

  const totalEvaluations = retrievalSummary.totalCount + groundingSummary.totalCount;
  const totalPassed = retrievalSummary.passedCount + groundingSummary.passedCount;
  const totalFailed = retrievalSummary.failedCount + groundingSummary.failedCount;

  return {
    datasetSummary: {
      totalCases: cases.length,
      positiveCaseCount: retrievalMetrics.positiveCaseCount,
      negativeCaseCount: cases.length - retrievalMetrics.positiveCaseCount,
    },
    retrievalMetrics,
    failureAnalysis,
    groundingMetrics,
    overallSummary: {
      totalEvaluations,
      totalPassed,
      totalFailed,
      overallPassRate: totalEvaluations === 0 ? 0 : totalPassed / totalEvaluations,
    },
  };
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Renders every section with the existing per-section formatter
 * (`formatRetrievalMetricsReport`, `formatRetrievalFailureReport`,
 * `formatGroundingMetricsReport`) under a shared set of top-level headers —
 * the single consolidated report this task asks for.
 */
export function formatUnifiedEvaluationReport(report: UnifiedEvaluationReport): string {
  return [
    "========================================",
    "UNIFIED EVALUATION REPORT",
    "========================================",
    "",
    "== Dataset Summary ==",
    `Total cases: ${report.datasetSummary.totalCases}`,
    `Positive cases: ${report.datasetSummary.positiveCaseCount}`,
    `Negative cases: ${report.datasetSummary.negativeCaseCount}`,
    "",
    "== Retrieval Metrics ==",
    formatRetrievalMetricsReport(report.retrievalMetrics),
    "",
    "== Failure Analysis ==",
    formatRetrievalFailureReport(report.failureAnalysis),
    "",
    "== Grounding Metrics ==",
    formatGroundingMetricsReport(report.groundingMetrics),
    "",
    "== Overall Summary ==",
    `Total evaluations: ${report.overallSummary.totalEvaluations}`,
    `Passed: ${report.overallSummary.totalPassed}`,
    `Failed: ${report.overallSummary.totalFailed}`,
    `Overall pass rate: ${toPercent(report.overallSummary.overallPassRate)}`,
  ].join("\n");
}
