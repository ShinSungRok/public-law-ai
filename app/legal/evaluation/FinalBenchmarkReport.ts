import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { EvaluationCase } from "./EvaluationCase";
import {
  formatProductionBenchmarkReport,
  runProductionBenchmark,
  type ProductionBenchmarkOptions,
  type ProductionBenchmarkReport,
  type ProductionBenchmarkVariantConfig,
  type ProductionBenchmarkVariantResult,
} from "./ProductionBenchmark";

/**
 * What this benchmark suite does and does not measure — surfaced in every
 * FinalBenchmarkReport so a reader of the numbers sees the caveats in the
 * same place as the numbers themselves, not only in prose documentation.
 */
export const KNOWN_BENCHMARK_LIMITATIONS: string[] = [
  "Embeddings are produced by FakeEmbeddingProvider, a deterministic hash-based vector generator, not a real embedding model (e.g. OpenAI/Cohere text-embedding-*). Vector/Hybrid/Re-ranked-Hybrid quality numbers measure the retrieval pipeline's wiring, not real semantic embedding quality.",
  "Re-ranking uses FakeReRanker, a deterministic query-term-overlap scorer, not a real cross-encoder or LLM-based re-ranker. Re-ranked Hybrid numbers measure the re-ranking pipeline (candidateTopK/finalTopN windowing, ReRankingSearchEngine wiring), not real re-ranking model quality.",
  "Grounding is measured against a deterministic echo fake LLM provider, not a real AI Provider call. Grounded Answer / Citation Coverage measure the grounding pipeline's wiring, not real generation quality.",
  "OpenSearch is replaced by FakeOpenSearchClient (in-memory), and the corpus is a small, fixed set of real statute articles (REAL_ARTICLE_DOCUMENTS), not the full production index. Absolute latency numbers isolate pipeline overhead in a single Node process; they do not reflect a production OpenSearch cluster under concurrent load.",
];

export interface FinalBenchmarkReport {
  productionBenchmark: ProductionBenchmarkReport;
  recommendedConfiguration: ProductionBenchmarkVariantResult;
  limitations: string[];
}

/**
 * Deterministic selection rule for the final recommended retrieval
 * configuration among already-benchmarked production variants — the same
 * rule already established by selectBestHybridRrfCandidate (Phase 28) and
 * selectBestReRankingCandidate (Phase 29), restated here because
 * ProductionBenchmarkVariantResult is its own shape (quality: ...) rather
 * than either of those candidates' (variant: ...): highest Hit Rate first
 * (finds an expected document at all), then fewest retrieval failures, then
 * highest MRR (rank quality) as the final tie-break. No metric is
 * recomputed here — every score compared was already produced by
 * runProductionBenchmark (i.e. by runBm25RetrievalBenchmarkVariant,
 * unmodified).
 */
export function selectRecommendedProductionVariant(
  variants: ProductionBenchmarkVariantResult[],
): ProductionBenchmarkVariantResult {
  if (variants.length === 0) {
    throw new Error("selectRecommendedProductionVariant requires at least one variant");
  }

  return variants.reduce((best, variant) => {
    if (variant.quality.metrics.hitRate !== best.quality.metrics.hitRate) {
      return variant.quality.metrics.hitRate > best.quality.metrics.hitRate ? variant : best;
    }
    if (variant.quality.failureReport.failureCount !== best.quality.failureReport.failureCount) {
      return variant.quality.failureReport.failureCount < best.quality.failureReport.failureCount
        ? variant
        : best;
    }
    return variant.quality.metrics.mrr > best.quality.metrics.mrr ? variant : best;
  });
}

/**
 * Runs the existing, unmodified production benchmark (runProductionBenchmark,
 * Phase 30 Task 1) across every configured variant, then packages it with
 * the recommended configuration and the known benchmark limitations into one
 * deterministic final report. No quality/grounding/latency number is
 * computed a second time here — this only orchestrates and selects among
 * runProductionBenchmark's own output.
 */
export async function runFinalBenchmarkReport(
  variantConfigs: ProductionBenchmarkVariantConfig[],
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
  options: ProductionBenchmarkOptions = {},
): Promise<FinalBenchmarkReport> {
  const productionBenchmark = await runProductionBenchmark(variantConfigs, cases, repository, options);
  const recommendedConfiguration = selectRecommendedProductionVariant(productionBenchmark.variants);

  return {
    productionBenchmark,
    recommendedConfiguration,
    limitations: KNOWN_BENCHMARK_LIMITATIONS,
  };
}

/** Renders the full production benchmark (via formatProductionBenchmarkReport, unmodified) plus the recommended configuration and known limitations — no formatting logic is duplicated. */
export function formatFinalBenchmarkReport(report: FinalBenchmarkReport): string {
  return [
    "========================================",
    "FINAL BENCHMARK REPORT",
    "========================================",
    "",
    formatProductionBenchmarkReport(report.productionBenchmark),
    "== Recommended Configuration ==",
    `${report.recommendedConfiguration.label} ` +
      "(selectRecommendedProductionVariant: highest Hit Rate, then fewest retrieval failures, then highest MRR)",
    "",
    "== Known Benchmark Limitations ==",
    ...report.limitations.map((limitation) => `- ${limitation}`),
  ].join("\n");
}
