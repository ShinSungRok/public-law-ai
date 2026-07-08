import { toSearchResult } from "./model/SearchHitMapper";
import type { SearchResult } from "./model/SearchResult";
import type { SearchSource } from "./model/SearchSource";
import type { SearchEngine } from "./SearchEngine";
import type { SearchQuery } from "./SearchQuery";

export interface HybridSearchEngineSource {
  engine: SearchEngine;
  source: SearchSource;
}

export class HybridSearchEngine {
  constructor(private readonly sources: HybridSearchEngineSource[]) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const resultsBySource = await Promise.all(
      this.sources.map(async ({ engine, source }) => {
        const hits = await engine.search(query);
        return hits.map((hit) => toSearchResult(hit, source));
      }),
    );

    return resultsBySource.flat();
  }
}
