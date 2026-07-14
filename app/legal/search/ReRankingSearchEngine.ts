import type { ReRanker } from "./ReRanker";
import type { SearchEngine } from "./SearchEngine";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

export interface ReRankingSearchEngineOptions {
  candidateTopK?: number;
  finalTopN?: number;
}

const DEFAULT_CANDIDATE_TOP_K = 50;
const DEFAULT_FINAL_TOP_N = 10;

/**
 * Decorates any existing SearchEngine (BM25, Vector, Hybrid, ...) as a
 * candidate source: fetches up to candidateTopK hits from it, re-ranks them
 * via a ReRanker, then returns the top finalTopN. Never touches the wrapped
 * engine's retrieval/fusion logic, and is itself a SearchEngine — usable
 * anywhere one is expected (e.g. the existing, unmodified SearchEngineRetriever).
 */
export class ReRankingSearchEngine implements SearchEngine {
  private readonly candidateTopK: number;
  private readonly finalTopN: number;

  constructor(
    private readonly candidateSource: SearchEngine,
    private readonly reRanker: ReRanker,
    options: ReRankingSearchEngineOptions = {},
  ) {
    this.candidateTopK = options.candidateTopK ?? DEFAULT_CANDIDATE_TOP_K;
    this.finalTopN = options.finalTopN ?? DEFAULT_FINAL_TOP_N;
  }

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const candidateQuery: SearchQuery = { ...query, limit: this.candidateTopK };
    const candidates = await this.candidateSource.search(candidateQuery);
    const topCandidates = candidates.slice(0, this.candidateTopK);

    const reRanked = await this.reRanker.rerank(query, topCandidates);

    return reRanked.slice(0, this.finalTopN);
  }
}
