import {
  HIT_RATE_METRIC_NAME,
  MRR_METRIC_NAME,
  RECALL_AT_1_METRIC_NAME,
  RECALL_AT_3_METRIC_NAME,
  RECALL_AT_5_METRIC_NAME,
} from "./RetrievalMetricsEvaluationRunner";
import type { RetrievalMetricsReport } from "./RetrievalMetricsReport";
import type { Bm25BenchmarkVariantResult } from "./Bm25RetrievalBenchmark";
import { formatBm25BenchmarkVariant } from "./Bm25RetrievalBenchmark";

/** current - baseline for one named retrieval metric. Reuses the exact metric name constants RetrievalMetricsEvaluationRunner already exports — no metric is renamed or recomputed here, only diffed. */
export interface Bm25BenchmarkMetricDelta {
  metricName: string;
  baselineScore: number;
  currentScore: number;
  delta: number;
}

export interface Bm25RetrievalBenchmarkComparison {
  baseline: Bm25BenchmarkVariantResult;
  current: Bm25BenchmarkVariantResult;
  metricDeltas: Bm25BenchmarkMetricDelta[];
  /** current.failureReport.failureCount - baseline.failureReport.failureCount (negative = fewer failures = improvement). */
  failureCountDelta: number;
}

interface MetricSelector {
  name: string;
  select: (report: RetrievalMetricsReport) => number;
}

const RETRIEVAL_METRIC_SELECTORS: MetricSelector[] = [
  { name: HIT_RATE_METRIC_NAME, select: (report) => report.hitRate },
  { name: RECALL_AT_1_METRIC_NAME, select: (report) => report.recallAt1 },
  { name: RECALL_AT_3_METRIC_NAME, select: (report) => report.recallAt3 },
  { name: RECALL_AT_5_METRIC_NAME, select: (report) => report.recallAt5 },
  { name: MRR_METRIC_NAME, select: (report) => report.mrr },
];

/**
 * Diffs two already-computed Bm25BenchmarkVariantResult's Retrieval Metrics
 * and failure counts, metric by metric. No metric is recomputed — every
 * score compared here was already produced by RetrievalMetricsEvaluationRunner/
 * buildRetrievalFailureReport (both unmodified); this only subtracts two
 * already-computed numbers per metric. Generic over any two labeled
 * variants, so it is equally the mechanism a later Vector/Hybrid/Re-ranking
 * benchmark would use to compare itself against this recorded BM25 baseline.
 */
export function compareBm25BenchmarkVariants(
  baseline: Bm25BenchmarkVariantResult,
  current: Bm25BenchmarkVariantResult,
): Bm25RetrievalBenchmarkComparison {
  const metricDeltas: Bm25BenchmarkMetricDelta[] = RETRIEVAL_METRIC_SELECTORS.map((selector) => {
    const baselineScore = selector.select(baseline.metrics);
    const currentScore = selector.select(current.metrics);
    return {
      metricName: selector.name,
      baselineScore,
      currentScore,
      delta: currentScore - baselineScore,
    };
  });

  return {
    baseline,
    current,
    metricDeltas,
    failureCountDelta: current.failureReport.failureCount - baseline.failureReport.failureCount,
  };
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4);
}

function formatIntegerDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

/** Renders both variants (via formatBm25BenchmarkVariant) plus a per-metric delta table and the failure count delta. */
export function formatBm25RetrievalBenchmarkComparison(
  comparison: Bm25RetrievalBenchmarkComparison,
): string {
  const deltaLines = comparison.metricDeltas.map(
    (entry) =>
      `${entry.metricName}: ${entry.baselineScore.toFixed(4)} -> ${entry.currentScore.toFixed(4)} (${formatDelta(entry.delta)})`,
  );

  return [
    formatBm25BenchmarkVariant(comparison.baseline),
    "",
    formatBm25BenchmarkVariant(comparison.current),
    "",
    "== Metric Deltas (current - baseline) ==",
    ...deltaLines,
    `retrieval failures: ${comparison.baseline.failureReport.failureCount} -> ${comparison.current.failureReport.failureCount} (${formatIntegerDelta(comparison.failureCountDelta)})`,
  ].join("\n");
}
