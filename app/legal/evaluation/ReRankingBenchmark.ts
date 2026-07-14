import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { Bm25BenchmarkVariantResult } from "./Bm25RetrievalBenchmark";
import { runBm25RetrievalBenchmarkVariant } from "./Bm25RetrievalBenchmark";
import type { EvaluationCase } from "./EvaluationCase";

/** One (candidateTopK, finalTopN) re-ranking configuration to benchmark. */
export interface ReRankingTuningCandidateConfig {
  candidateTopK: number;
  finalTopN: number;
}

/** One re-ranking configuration's full benchmark result — produced entirely by the existing, unmodified benchmark framework. */
export interface ReRankingTuningCandidate extends ReRankingTuningCandidateConfig {
  variant: Bm25BenchmarkVariantResult;
}

export interface ReRankingTuningResult {
  candidates: ReRankingTuningCandidate[];
  best: ReRankingTuningCandidate;
}

/**
 * Deterministic selection rule for choosing among already-benchmarked
 * (candidateTopK, finalTopN) re-ranking configurations — identical rule to
 * selectBestHybridRrfCandidate: highest hit rate first (finds an expected
 * document at all), then fewest retrieval failures, then highest MRR (rank
 * quality) as the final tie-break. No retrieval or re-ranking logic is
 * recomputed here — every score compared was already produced by
 * runBm25RetrievalBenchmarkVariant (i.e. by ReRankingSearchEngine/
 * FakeReRanker, unmodified).
 */
export function selectBestReRankingCandidate(
  candidates: ReRankingTuningCandidate[],
): ReRankingTuningCandidate {
  if (candidates.length === 0) {
    throw new Error("selectBestReRankingCandidate requires at least one candidate");
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
 * Benchmarks a small deterministic set of (candidateTopK, finalTopN)
 * re-ranking configurations by calling runBm25RetrievalBenchmarkVariant
 * (unmodified) once per configuration, then picks the best via
 * selectBestReRankingCandidate. `buildReRankingRetriever` is the caller's
 * factory (mirrors tuneHybridRrfK's own buildHybridRetriever) — this
 * function never constructs a ReRankingSearchEngine or FakeReRanker itself,
 * only exercises whatever the caller builds for each configuration, so no
 * metric is computed more than once per configuration.
 */
export async function tuneReRanking(
  configs: ReRankingTuningCandidateConfig[],
  buildReRankingRetriever: (config: ReRankingTuningCandidateConfig) => Retriever,
  cases: EvaluationCase[],
  repository: LegalDocumentRepository,
): Promise<ReRankingTuningResult> {
  const candidates: ReRankingTuningCandidate[] = [];
  for (const config of configs) {
    const variant = await runBm25RetrievalBenchmarkVariant(
      `reranked-k${config.candidateTopK}-n${config.finalTopN}`,
      buildReRankingRetriever(config),
      cases,
      repository,
    );
    candidates.push({ ...config, variant });
  }

  return { candidates, best: selectBestReRankingCandidate(candidates) };
}
