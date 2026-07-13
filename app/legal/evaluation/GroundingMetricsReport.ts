import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationResult } from "./EvaluationResult";
import {
  CITATION_COVERAGE_METRIC_NAME,
  CONTEXT_COVERAGE_METRIC_NAME,
  GROUNDED_ANSWER_METRIC_NAME,
  UNSUPPORTED_CLAIMS_METRIC_NAME,
} from "./GroundingMetricsEvaluationRunner";

export interface GroundingMetricsReport {
  datasetSize: number;
  /** Cases with at least one expected document — the only cases Context Coverage is meaningful for. */
  positiveCaseCount: number;
  averageContextCoverage: number;
  averageGroundedAnswer: number;
  totalUnsupportedClaims: number;
  casesWithUnsupportedClaims: number;
  averageCitationCoverage: number;
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
 * Aggregates per-case grounding metrics into a dataset-level summary report.
 * Mirrors RetrievalMetricsReport.buildRetrievalMetricsReport's shape and its
 * exclusion of vacuous (no-expected-document) cases from the Context
 * Coverage average — Grounded Answer and Citation Coverage apply regardless
 * of whether the case has expected documents, so they average over every
 * case.
 */
export function buildGroundingMetricsReport(
  cases: EvaluationCase[],
  results: EvaluationResult[],
): GroundingMetricsReport {
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

  const unsupportedClaimCounts = results.map((result) =>
    metricScore(result, UNSUPPORTED_CLAIMS_METRIC_NAME),
  );

  return {
    datasetSize: cases.length,
    positiveCaseCount: positiveResults.length,
    averageContextCoverage: average(
      positiveResults.map((result) => metricScore(result, CONTEXT_COVERAGE_METRIC_NAME)),
    ),
    averageGroundedAnswer: average(
      results.map((result) => metricScore(result, GROUNDED_ANSWER_METRIC_NAME)),
    ),
    totalUnsupportedClaims: unsupportedClaimCounts.reduce((sum, count) => sum + count, 0),
    casesWithUnsupportedClaims: unsupportedClaimCounts.filter((count) => count > 0).length,
    averageCitationCoverage: average(
      results.map((result) => metricScore(result, CITATION_COVERAGE_METRIC_NAME)),
    ),
  };
}

function toPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatGroundingMetricsReport(report: GroundingMetricsReport): string {
  return [
    `Dataset: ${report.datasetSize}`,
    `Context Coverage: ${toPercent(report.averageContextCoverage)}`,
    `Grounded Answer: ${toPercent(report.averageGroundedAnswer)}`,
    `Unsupported Claims: ${report.totalUnsupportedClaims} total across ${report.casesWithUnsupportedClaims} case(s)`,
    `Citation Coverage: ${toPercent(report.averageCitationCoverage)}`,
  ].join("\n");
}
