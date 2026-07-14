import type { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { Bm25BenchmarkVariantResult } from "./Bm25RetrievalBenchmark";
import { formatBm25BenchmarkVariant, runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import type { EvaluationCase } from "./EvaluationCase";
import { GroundingMetricsEvaluationRunner } from "./GroundingMetricsEvaluationRunner";
import {
  buildGroundingMetricsReport,
  formatGroundingMetricsReport,
  type GroundingMetricsReport,
} from "./GroundingMetricsReport";

const DEFAULT_LATENCY_RUN_COUNT = 3;

export interface LatencyStatistics {
  averageMs: number;
  minMs: number;
  maxMs: number;
  runCount: number;
}

/** One retrieval variant to benchmark in production terms: its Retriever, and (optionally, where a full RAG pipeline exists for it) the use case grounding is measured against. */
export interface ProductionBenchmarkVariantConfig {
  label: string;
  retriever: Retriever;
  ragAnswerUseCase?: GenerateRagAnswerUseCase;
}

export interface ProductionBenchmarkOptions {
  /** How many timed passes to run per latency channel — averageMs/minMs/maxMs are computed across these, quality/grounding are computed once (see runProductionBenchmarkVariant). */
  latencyRunCount?: number;
}

export interface ProductionBenchmarkVariantResult {
  label: string;
  /** Retrieval metrics + failure analysis, computed exactly once — entirely Bm25RetrievalBenchmark's (unmodified) output, never recomputed here. */
  quality: Bm25BenchmarkVariantResult;
  /** Present only when the variant config carried a ragAnswerUseCase ("where applicable") — entirely GroundingMetricsReport's (unmodified) output. */
  grounding: GroundingMetricsReport | undefined;
  /** Time to retrieve for every case in the dataset, once per Retriever.retrieve call — isolates pure retrieval cost. */
  retrievalLatency: LatencyStatistics;
  /** Time to run the full benchmark pipeline (quality, plus grounding where applicable) for the dataset — the cost a caller actually pays to produce this variant's numbers. */
  endToEndLatency: LatencyStatistics;
}

export interface ProductionBenchmarkReport {
  variants: ProductionBenchmarkVariantResult[];
}

/** Non-empty-checked average/min/max over a set of duration samples in milliseconds. */
export function computeLatencyStatistics(durationsMs: number[]): LatencyStatistics {
  if (durationsMs.length === 0) {
    throw new Error("computeLatencyStatistics requires at least one duration sample");
  }

  return {
    averageMs: durationsMs.reduce((sum, duration) => sum + duration, 0) / durationsMs.length,
    minMs: Math.min(...durationsMs),
    maxMs: Math.max(...durationsMs),
    runCount: durationsMs.length,
  };
}

async function measureDurationMs(work: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await work();
  return performance.now() - start;
}

async function retrieveDataset(retriever: Retriever, cases: EvaluationCase[]): Promise<void> {
  for (const evaluationCase of cases) {
    await retriever.retrieve(evaluationCase.query);
  }
}

async function runGroundingReport(
  ragAnswerUseCase: GenerateRagAnswerUseCase,
  retriever: Retriever,
  cases: EvaluationCase[],
): Promise<GroundingMetricsReport> {
  const groundingSummary = await new GroundingMetricsEvaluationRunner(retriever, ragAnswerUseCase).runMany(cases);
  return buildGroundingMetricsReport(cases, groundingSummary.results);
}

/**
 * Benchmarks one retrieval variant with both quality and latency numbers.
 *
 * Quality (and grounding, where a ragAnswerUseCase is configured) is
 * computed exactly once via the existing, unmodified
 * runBm25RetrievalBenchmarkVariant / GroundingMetricsEvaluationRunner /
 * buildGroundingMetricsReport — no metric formula is duplicated or
 * reimplemented here. Latency is a separate concern: retrievalLatency and
 * endToEndLatency each re-run their respective (unmodified) operation
 * latencyRunCount times purely to sample wall-clock duration — those
 * repeated runs are deterministic in every field except the timing itself
 * (see runReRankingBenchmarkValidation.ts-style determinism checks in this
 * module's validation script), so no case is scored more than once for the
 * numbers this function actually reports.
 */
export async function runProductionBenchmarkVariant(
  variantConfig: ProductionBenchmarkVariantConfig,
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
  options: ProductionBenchmarkOptions = {},
): Promise<ProductionBenchmarkVariantResult> {
  const runCount = options.latencyRunCount ?? DEFAULT_LATENCY_RUN_COUNT;
  const { label, retriever, ragAnswerUseCase } = variantConfig;

  const quality = await runBm25RetrievalBenchmarkVariant(label, retriever, cases, repository);
  const grounding = ragAnswerUseCase
    ? await runGroundingReport(ragAnswerUseCase, retriever, cases)
    : undefined;

  const retrievalDurationsMs: number[] = [];
  for (let run = 0; run < runCount; run += 1) {
    retrievalDurationsMs.push(await measureDurationMs(() => retrieveDataset(retriever, cases)));
  }

  const endToEndDurationsMs: number[] = [];
  for (let run = 0; run < runCount; run += 1) {
    endToEndDurationsMs.push(
      await measureDurationMs(async () => {
        await runBm25RetrievalBenchmarkVariant(label, retriever, cases, repository);
        if (ragAnswerUseCase) {
          await runGroundingReport(ragAnswerUseCase, retriever, cases);
        }
      }),
    );
  }

  return {
    label,
    quality,
    grounding,
    retrievalLatency: computeLatencyStatistics(retrievalDurationsMs),
    endToEndLatency: computeLatencyStatistics(endToEndDurationsMs),
  };
}

/** Runs runProductionBenchmarkVariant once per configured variant (BM25, Vector, Hybrid, Re-ranked Hybrid, ...) and collects them into one report. */
export async function runProductionBenchmark(
  variantConfigs: ProductionBenchmarkVariantConfig[],
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
  options: ProductionBenchmarkOptions = {},
): Promise<ProductionBenchmarkReport> {
  const variants: ProductionBenchmarkVariantResult[] = [];
  for (const variantConfig of variantConfigs) {
    variants.push(await runProductionBenchmarkVariant(variantConfig, cases, repository, options));
  }
  return { variants };
}

function formatLatencyStatistics(label: string, stats: LatencyStatistics): string {
  return `${label}: avg=${stats.averageMs.toFixed(2)}ms min=${stats.minMs.toFixed(2)}ms max=${stats.maxMs.toFixed(2)}ms (n=${stats.runCount})`;
}

/** Renders one variant using the existing per-report formatters (formatBm25BenchmarkVariant, formatGroundingMetricsReport) plus latency — no formatting logic is duplicated. */
export function formatProductionBenchmarkVariant(variant: ProductionBenchmarkVariantResult): string {
  const lines = [formatBm25BenchmarkVariant(variant.quality)];

  if (variant.grounding) {
    lines.push("", "Grounding:", formatGroundingMetricsReport(variant.grounding));
  }

  lines.push(
    "",
    formatLatencyStatistics("Retrieval latency", variant.retrievalLatency),
    formatLatencyStatistics("End-to-end latency", variant.endToEndLatency),
  );

  return lines.join("\n");
}

/** Consolidated report across every benchmarked variant — the single artifact this task asks for. */
export function formatProductionBenchmarkReport(report: ProductionBenchmarkReport): string {
  return [
    "========================================",
    "PRODUCTION BENCHMARK REPORT",
    "========================================",
    "",
    ...report.variants.flatMap((variant) => [formatProductionBenchmarkVariant(variant), ""]),
  ].join("\n");
}
