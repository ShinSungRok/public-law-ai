import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationResult } from "./EvaluationResult";
import { analyzeRetrievalFailures, type RetrievalCaseAnalysis } from "./RetrievalFailureAnalyzer";
import {
  buildRetrievalFailureReport,
  formatRetrievalFailureReport,
  type RetrievalFailureReport,
} from "./RetrievalFailureReport";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import {
  buildRetrievalMetricsReport,
  formatRetrievalMetricsReport,
  type RetrievalMetricsReport,
} from "./RetrievalMetricsReport";

/**
 * One labeled retrieval strategy's result against a dataset — BM25 today,
 * and (unchanged shape) Vector/Hybrid/Re-ranking retrievers later. Both
 * fields are exactly what buildRetrievalMetricsReport/buildRetrievalFailureReport
 * already produce; this adds a `label` for identifying which retriever
 * variant produced them, nothing else.
 */
export interface Bm25BenchmarkVariantResult {
  label: string;
  metrics: RetrievalMetricsReport;
  failureReport: RetrievalFailureReport;
}

/**
 * Composes a labeled benchmark variant from already-computed evaluator
 * output. No metric is recomputed here — hitRate/recallAt1/recallAt3/
 * recallAt5/mrr come from buildRetrievalMetricsReport (Task 2's, unmodified)
 * and failureCount comes from buildRetrievalFailureReport (Task 3's,
 * unmodified); this function only labels and packages their results.
 */
export function buildBm25BenchmarkVariantResult(
  label: string,
  cases: EvaluationCase[],
  retrievalResults: EvaluationResult[],
  failureAnalyses: RetrievalCaseAnalysis[],
): Bm25BenchmarkVariantResult {
  return {
    label,
    metrics: buildRetrievalMetricsReport(cases, retrievalResults),
    failureReport: buildRetrievalFailureReport(failureAnalyses),
  };
}

/**
 * Runs one retriever variant end-to-end against `cases`: retrieval metrics
 * via RetrievalMetricsEvaluationRunner (Task 2, unmodified) and failure
 * analysis via analyzeRetrievalFailures (Task 3, unmodified), then packages
 * both into a labeled Bm25BenchmarkVariantResult. This is the reusable
 * entry point later benchmarks (Vector, Hybrid, Re-ranking) call with their
 * own Retriever implementation and label — nothing here is BM25-specific.
 */
export async function runBm25RetrievalBenchmarkVariant(
  label: string,
  retriever: Retriever,
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
): Promise<Bm25BenchmarkVariantResult> {
  const retrievalSummary = await new RetrievalMetricsEvaluationRunner(retriever).runMany(cases);
  const failureAnalyses = await analyzeRetrievalFailures(cases, retriever, repository);

  return buildBm25BenchmarkVariantResult(label, cases, retrievalSummary.results, failureAnalyses);
}

/** Renders one variant using the existing per-report formatters — no metric formatting logic is duplicated. */
export function formatBm25BenchmarkVariant(variant: Bm25BenchmarkVariantResult): string {
  return [
    `-- ${variant.label} --`,
    formatRetrievalMetricsReport(variant.metrics),
    `Retrieval failures: ${variant.failureReport.failureCount}`,
  ].join("\n");
}

/** Full per-variant detail, including the failure category breakdown (RetrievalFailureReport, unmodified). */
export function formatBm25BenchmarkVariantDetailed(variant: Bm25BenchmarkVariantResult): string {
  return [
    `-- ${variant.label} --`,
    formatRetrievalMetricsReport(variant.metrics),
    "",
    formatRetrievalFailureReport(variant.failureReport),
  ].join("\n");
}
