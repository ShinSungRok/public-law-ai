import {
  CITATION_COVERAGE_METRIC_NAME,
  CONTEXT_COVERAGE_METRIC_NAME,
  GROUNDED_ANSWER_METRIC_NAME,
  UNSUPPORTED_CLAIMS_METRIC_NAME,
} from "./GroundingMetricsEvaluationRunner";
import type { GroundingMetricsReport } from "./GroundingMetricsReport";
import {
  HIT_RATE_METRIC_NAME,
  MRR_METRIC_NAME,
  RECALL_AT_1_METRIC_NAME,
  RECALL_AT_3_METRIC_NAME,
  RECALL_AT_5_METRIC_NAME,
} from "./RetrievalMetricsEvaluationRunner";
import type { RetrievalMetricsReport } from "./RetrievalMetricsReport";
import type { UnifiedEvaluationReport } from "./UnifiedEvaluationReport";

/** Minimum absolute delta (same units as the metric's score) required for a metric to count as improved/regressed rather than unchanged. Always caller-overridable — see `compareUnifiedEvaluationReports`. */
export const DEFAULT_REGRESSION_THRESHOLD = 0.01;

export type MetricRegressionStatus = "improved" | "unchanged" | "regressed";
type MetricRegressionSection = "retrieval" | "grounding";
type MetricDirection = "higher-is-better" | "lower-is-better";

export interface MetricRegressionComparison {
  metricName: string;
  section: MetricRegressionSection;
  baselineScore: number;
  currentScore: number;
  /** current - baseline (signed). Direction of "good" depends on the metric — see `status`. */
  delta: number;
  /** Magnitude of `delta` — this is what is actually checked against `threshold`. */
  absoluteDelta: number;
  threshold: number;
  status: MetricRegressionStatus;
}

export interface UnifiedReportRegressionComparison {
  threshold: number;
  metricComparisons: MetricRegressionComparison[];
  improvedCount: number;
  unchangedCount: number;
  regressedCount: number;
  hasRegressions: boolean;
}

/**
 * The subset of a `UnifiedEvaluationReport` this comparator actually reads.
 * Any real `UnifiedEvaluationReport` (e.g. from `UnifiedEvaluationRunner.run()`)
 * satisfies this structurally, so it can be passed in directly — this
 * narrower type just lets callers build minimal, fully deterministic
 * fixtures for testing without fabricating unused failureAnalysis /
 * datasetSummary / overallSummary sections this comparator never looks at.
 */
export type UnifiedEvaluationReportMetricsView = Pick<
  UnifiedEvaluationReport,
  "retrievalMetrics" | "groundingMetrics"
>;

interface MetricSelector<T> {
  name: string;
  direction: MetricDirection;
  select: (report: T) => number;
}

// Reuses the exact metric name constants RetrievalMetricsEvaluationRunner
// (Task 2) already exports — no metric is renamed or recomputed here, only
// diffed between two already-computed reports.
const RETRIEVAL_METRIC_SELECTORS: MetricSelector<RetrievalMetricsReport>[] = [
  { name: HIT_RATE_METRIC_NAME, direction: "higher-is-better", select: (report) => report.hitRate },
  { name: RECALL_AT_1_METRIC_NAME, direction: "higher-is-better", select: (report) => report.recallAt1 },
  { name: RECALL_AT_3_METRIC_NAME, direction: "higher-is-better", select: (report) => report.recallAt3 },
  { name: RECALL_AT_5_METRIC_NAME, direction: "higher-is-better", select: (report) => report.recallAt5 },
  { name: MRR_METRIC_NAME, direction: "higher-is-better", select: (report) => report.mrr },
];

// Reuses the exact metric name constants GroundingMetricsEvaluationRunner
// (Task 4) already exports. Unsupported Claims is the one lower-is-better
// metric in this framework (fewer unsupported claims is an improvement) —
// every other metric here is higher-is-better.
const GROUNDING_METRIC_SELECTORS: MetricSelector<GroundingMetricsReport>[] = [
  {
    name: CONTEXT_COVERAGE_METRIC_NAME,
    direction: "higher-is-better",
    select: (report) => report.averageContextCoverage,
  },
  {
    name: GROUNDED_ANSWER_METRIC_NAME,
    direction: "higher-is-better",
    select: (report) => report.averageGroundedAnswer,
  },
  {
    name: UNSUPPORTED_CLAIMS_METRIC_NAME,
    direction: "lower-is-better",
    select: (report) => report.totalUnsupportedClaims,
  },
  {
    name: CITATION_COVERAGE_METRIC_NAME,
    direction: "higher-is-better",
    select: (report) => report.averageCitationCoverage,
  },
];

function classifyStatus(
  delta: number,
  absoluteDelta: number,
  threshold: number,
  direction: MetricDirection,
): MetricRegressionStatus {
  if (absoluteDelta <= threshold) {
    return "unchanged";
  }
  const improved = direction === "higher-is-better" ? delta > 0 : delta < 0;
  return improved ? "improved" : "regressed";
}

function compareMetric(
  section: MetricRegressionSection,
  metricName: string,
  direction: MetricDirection,
  baselineScore: number,
  currentScore: number,
  threshold: number,
): MetricRegressionComparison {
  const delta = currentScore - baselineScore;
  const absoluteDelta = Math.abs(delta);

  return {
    metricName,
    section,
    baselineScore,
    currentScore,
    delta,
    absoluteDelta,
    threshold,
    status: classifyStatus(delta, absoluteDelta, threshold, direction),
  };
}

/**
 * Compares a baseline and a current `UnifiedEvaluationReport`'s Retrieval
 * Metrics (Task 2) and Grounding Metrics (Task 4) sections, metric by
 * metric. No metric is recomputed — every score compared here was already
 * produced by `RetrievalMetricsEvaluationRunner`/`GroundingMetricsEvaluationRunner`
 * via `UnifiedEvaluationRunner`; this only diffs the two already-computed
 * numbers per metric. `threshold` (defaulting to `DEFAULT_REGRESSION_THRESHOLD`)
 * is the minimum absolute delta required for a metric to count as
 * improved/regressed rather than unchanged, and is always explicitly
 * caller-controlled.
 */
export function compareUnifiedEvaluationReports(
  baseline: UnifiedEvaluationReportMetricsView,
  current: UnifiedEvaluationReportMetricsView,
  threshold: number = DEFAULT_REGRESSION_THRESHOLD,
): UnifiedReportRegressionComparison {
  const retrievalComparisons = RETRIEVAL_METRIC_SELECTORS.map((selector) =>
    compareMetric(
      "retrieval",
      selector.name,
      selector.direction,
      selector.select(baseline.retrievalMetrics),
      selector.select(current.retrievalMetrics),
      threshold,
    ),
  );
  const groundingComparisons = GROUNDING_METRIC_SELECTORS.map((selector) =>
    compareMetric(
      "grounding",
      selector.name,
      selector.direction,
      selector.select(baseline.groundingMetrics),
      selector.select(current.groundingMetrics),
      threshold,
    ),
  );

  const metricComparisons = [...retrievalComparisons, ...groundingComparisons];

  return {
    threshold,
    metricComparisons,
    improvedCount: metricComparisons.filter((comparison) => comparison.status === "improved").length,
    unchangedCount: metricComparisons.filter((comparison) => comparison.status === "unchanged").length,
    regressedCount: metricComparisons.filter((comparison) => comparison.status === "regressed").length,
    hasRegressions: metricComparisons.some((comparison) => comparison.status === "regressed"),
  };
}

const STATUS_SYMBOL: Record<MetricRegressionStatus, string> = {
  improved: "▲",
  unchanged: "=",
  regressed: "▼",
};

function formatMetricComparison(comparison: MetricRegressionComparison): string {
  const signedDelta =
    comparison.delta >= 0 ? `+${comparison.delta.toFixed(4)}` : comparison.delta.toFixed(4);
  return `${STATUS_SYMBOL[comparison.status]} ${comparison.metricName}: ${comparison.baselineScore.toFixed(4)} -> ${comparison.currentScore.toFixed(4)} (${signedDelta}) [${comparison.status}]`;
}

/** Renders a regression comparison as a human-readable report — the "regression report formatter". */
export function formatUnifiedReportRegressionComparison(
  comparison: UnifiedReportRegressionComparison,
): string {
  const retrievalLines = comparison.metricComparisons
    .filter((entry) => entry.section === "retrieval")
    .map(formatMetricComparison);
  const groundingLines = comparison.metricComparisons
    .filter((entry) => entry.section === "grounding")
    .map(formatMetricComparison);

  return [
    "== Retrieval Metrics Regression ==",
    ...retrievalLines,
    "",
    "== Grounding Metrics Regression ==",
    ...groundingLines,
    "",
    "== Regression Summary ==",
    `Threshold: ${comparison.threshold}`,
    `Improved: ${comparison.improvedCount}`,
    `Unchanged: ${comparison.unchangedCount}`,
    `Regressed: ${comparison.regressedCount}`,
    comparison.hasRegressions ? "RESULT: REGRESSIONS DETECTED" : "RESULT: NO REGRESSIONS",
  ].join("\n");
}
