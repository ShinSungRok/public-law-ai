import { DefaultScoreFusionStrategy } from "./DefaultScoreFusionStrategy";
import { DefaultSearchResultFilter } from "./DefaultSearchResultFilter";
import { toSearchHit, toSearchResult } from "./model/SearchHitMapper";
import type { SearchResult } from "./model/SearchResult";
import type { SearchSource } from "./model/SearchSource";
import { ScoreDescendingSearchResultSorter } from "./ScoreDescendingSearchResultSorter";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";
import type { SearchEngine } from "./SearchEngine";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";
import type { SearchResultFilter } from "./SearchResultFilter";
import type { SearchResultSorter } from "./SearchResultSorter";

export interface HybridSearchEngineSource {
  engine: SearchEngine;
  source: SearchSource;
}

/**
 * Combines any number of existing SearchEngine implementations (BM25, vector,
 * ...) via a ScoreFusionStrategy (e.g. ReciprocalRankFusionStrategy),
 * deduplicates by document id, filters and sorts — then maps back to
 * SearchHit so it is itself a SearchEngine, usable anywhere one is expected
 * (e.g. the existing, unmodified SearchEngineRetriever).
 */
export class HybridSearchEngine implements SearchEngine {
  constructor(
    private readonly sources: HybridSearchEngineSource[],
    private readonly filter: SearchResultFilter = new DefaultSearchResultFilter(),
    private readonly fusionStrategy: ScoreFusionStrategy = new DefaultScoreFusionStrategy(),
    private readonly sorter: SearchResultSorter = new ScoreDescendingSearchResultSorter(),
  ) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const resultsBySource = await Promise.all(
      this.sources.map(async ({ engine, source }) => {
        const hits = await engine.search(query);
        return hits.map((hit) => toSearchResult(hit, source));
      }),
    );

    const fused = this.fusionStrategy.fuse(resultsBySource);
    const deduplicated = this.deduplicate(fused);
    const filtered = this.filter.filter(deduplicated);
    const sorted = this.sorter.sort(filtered);
    return sorted.map(toSearchHit);
  }

  private deduplicate(results: SearchResult[]): SearchResult[] {
    const byDocumentId = new Map<string, SearchResult>();

    for (const result of results) {
      const existing = byDocumentId.get(result.document.id);
      if (!existing || result.score > existing.score) {
        byDocumentId.set(result.document.id, result);
      }
    }

    return Array.from(byDocumentId.values());
  }
}
