import { DefaultScoreFusionStrategy } from "./DefaultScoreFusionStrategy";
import { DefaultSearchResultFilter } from "./DefaultSearchResultFilter";
import { toSearchResult } from "./model/SearchHitMapper";
import type { SearchResult } from "./model/SearchResult";
import type { SearchSource } from "./model/SearchSource";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";
import type { SearchEngine } from "./SearchEngine";
import type { SearchQuery } from "./SearchQuery";
import type { SearchResultFilter } from "./SearchResultFilter";

export interface HybridSearchEngineSource {
  engine: SearchEngine;
  source: SearchSource;
}

export class HybridSearchEngine {
  constructor(
    private readonly sources: HybridSearchEngineSource[],
    private readonly filter: SearchResultFilter = new DefaultSearchResultFilter(),
    private readonly fusionStrategy: ScoreFusionStrategy = new DefaultScoreFusionStrategy(),
  ) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const resultsBySource = await Promise.all(
      this.sources.map(async ({ engine, source }) => {
        const hits = await engine.search(query);
        return hits.map((hit) => toSearchResult(hit, source));
      }),
    );

    const fused = this.fusionStrategy.fuse(resultsBySource);
    const deduplicated = this.deduplicate(fused);
    return this.filter.filter(deduplicated);
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
