import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationResult } from "./EvaluationResult";
import {
  HIT_RATE_METRIC_NAME,
  MRR_METRIC_NAME,
  RECALL_AT_1_METRIC_NAME,
  RECALL_AT_3_METRIC_NAME,
  RECALL_AT_5_METRIC_NAME,
} from "./RetrievalMetricsEvaluationRunner";

export interface RetrievalMetricsReport {
  datasetSize: number;
  /** Cases with at least one expected document — the only cases a recall/rank signal is meaningful for. */
  positiveCaseCount: number;
  hitRate: number;
  recallAt1: number;
  recallAt3: number;
  recallAt5: number;
  mrr: number;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricScore(result: EvaluationResult, metricName: string): number {
  const metric = result.metrics.find((candidate) => candidate.name === metricName);
  if (!metric) {
    throw new Error(`evaluation result for case "${result.caseId}" is missing metric: ${metricName}`);
  }
  return metric.score;
}

/**
 * Aggregates per-case retrieval metrics into a dataset-level report.
 *
 * Cases with no expected documents (e.g. the dataset's negative/out-of-domain
 * cases) are excluded from the averages: RetrievalMetricsCalculator scores
 * them as a vacuous 1 (nothing to recall), and folding that placeholder into
 * the average would silently inflate Hit Rate/Recall/MRR rather than measure
 * anything real. `cases` and `results` must be the same evaluation cases in
 * the same order (as produced by `RetrievalMetricsEvaluationRunner.runMany`).
 */
export function buildRetrievalMetricsReport(
  cases: EvaluationCase[],
  results: EvaluationResult[],
): RetrievalMetricsReport {
  if (cases.length !== results.length) {
    throw new Error(
      `cases (${cases.length}) and results (${results.length}) must be the same length and order`,
    );
  }

  const positiveIndexes = cases
    .map((evaluationCase, index) => ({ evaluationCase, index }))
    .filter(({ evaluationCase }) => (evaluationCase.expectedDocumentIds?.length ?? 0) > 0)
    .map(({ index }) => index);

  const positiveResults = positiveIndexes.map((index) => results[index]);

  return {
    datasetSize: cases.length,
    positiveCaseCount: positiveResults.length,
    hitRate: average(positiveResults.map((result) => metricScore(result, HIT_RATE_METRIC_NAME))),
    recallAt1: average(positiveResults.map((result) => metricScore(result, RECALL_AT_1_METRIC_NAME))),
    recallAt3: average(positiveResults.map((result) => metricScore(result, RECALL_AT_3_METRIC_NAME))),
    recallAt5: average(positiveResults.map((result) => metricScore(result, RECALL_AT_5_METRIC_NAME))),
    mrr: average(positiveResults.map((result) => metricScore(result, MRR_METRIC_NAME))),
  };
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatRetrievalMetricsReport(report: RetrievalMetricsReport): string {
  return [
    `Dataset: ${report.datasetSize}`,
    `Hit Rate: ${toPercent(report.hitRate)}`,
    `Recall@1: ${toPercent(report.recallAt1)}`,
    `Recall@3: ${toPercent(report.recallAt3)}`,
    `Recall@5: ${toPercent(report.recallAt5)}`,
    `MRR: ${report.mrr.toFixed(2)}`,
  ].join("\n");
}
