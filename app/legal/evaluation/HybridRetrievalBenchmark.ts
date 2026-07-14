import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { Bm25BenchmarkVariantResult } from "./Bm25RetrievalBenchmark";
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import type { EvaluationCase } from "./EvaluationCase";

/** One RRF `k` candidate's full benchmark result — produced entirely by the existing, unmodified benchmark framework. */
export interface HybridRrfTuningCandidate {
  k: number;
  variant: Bm25BenchmarkVariantResult;
}

export interface HybridRrfTuningResult {
  candidates: HybridRrfTuningCandidate[];
  best: HybridRrfTuningCandidate;
}

/**
 * Deterministic selection rule for choosing among already-benchmarked RRF
 * `k` candidates: highest hit rate first (finds an expected document at
 * all), then fewest retrieval failures, then highest MRR (rank quality) as
 * the final tie-break. No retrieval or fusion logic is recomputed here —
 * every score compared was already produced by runBm25RetrievalBenchmarkVariant
 * (i.e. by HybridSearchEngine/ReciprocalRankFusionStrategy, unmodified).
 */
export function selectBestHybridRrfCandidate(
  candidates: HybridRrfTuningCandidate[],
): HybridRrfTuningCandidate {
  if (candidates.length === 0) {
    throw new Error("selectBestHybridRrfCandidate requires at least one candidate");
  }

  return candidates.reduce((best, candidate) => {
    if (candidate.variant.metrics.hitRate !== best.variant.metrics.hitRate) {
      return candidate.variant.metrics.hitRate > best.variant.metrics.hitRate ? candidate : best;
    }
    if (candidate.variant.failureReport.failureCount !== best.variant.failureReport.failureCount) {
      return candidate.variant.failureReport.failureCount < best.variant.failureReport.failureCount
        ? candidate
        : best;
    }
    return candidate.variant.metrics.mrr > best.variant.metrics.mrr ? candidate : best;
  });
}

/**
 * Benchmarks a set of RRF `k` candidates for a hybrid retriever by calling
 * runBm25RetrievalBenchmarkVariant (unmodified) once per candidate, then
 * picks the best via selectBestHybridRrfCandidate. `buildHybridRetriever` is
 * the caller's factory (mirrors how runBm25RetrievalBenchmarkVariant itself
 * takes a Retriever rather than constructing one) — this function never
 * constructs a HybridSearchEngine or ReciprocalRankFusionStrategy itself,
 * only exercises whatever the caller builds for each k.
 */
export async function tuneHybridRrfK(
  kCandidates: number[],
  buildHybridRetriever: (k: number) => Retriever,
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
): Promise<HybridRrfTuningResult> {
  const candidates: HybridRrfTuningCandidate[] = [];
  for (const k of kCandidates) {
    const variant = await runBm25RetrievalBenchmarkVariant(
      `hybrid-k${k}`,
      buildHybridRetriever(k),
      cases,
      repository,
    );
    candidates.push({ k, variant });
  }

  return { candidates, best: selectBestHybridRrfCandidate(candidates) };
}
