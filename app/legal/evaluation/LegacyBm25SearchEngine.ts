import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import type { OpenSearchSearchResponse } from "../search/opensearch/OpenSearchSearchResponse";
import { toSearchResults } from "../search/opensearch/OpenSearchSearchResponseMapper";
import type { SearchEngine } from "../search/SearchEngine";
import type { SearchHit } from "../search/SearchHit";
import type { SearchQuery } from "../search/SearchQuery";

const LEGACY_DEFAULT_SIZE = 10;

/**
 * The pre-Phase-26 multi_match shape (plain fields, no boost, no
 * tie_breaker) — frozen here as a fixed historical reference point so
 * later retrieval strategies (Vector, Hybrid, Re-ranking) can be measured
 * against both "no BM25 tuning at all" and the current optimized BM25
 * query. Production code builds its query via buildOpenSearchKeywordSearchBody
 * (OpenSearchSearchBodyBuilder.ts, Phase 26 Task 1); this function is never
 * imported by it and this file changes no search behavior.
 */
export function buildLegacyBm25SearchBody(query: SearchQuery): unknown {
  return {
    size: query.limit ?? LEGACY_DEFAULT_SIZE,
    query: {
      multi_match: {
        query: query.text,
        fields: ["title", "text"],
      },
    },
  };
}

/**
 * Mirrors OpenSearchSearchEngine.search() exactly, substituting the legacy
 * query body — isolates "which query shape was used" as the only variable
 * between a legacy and an optimized benchmark run, while still going
 * through the real OpenSearchClient and the real, unmodified
 * toSearchResults mapper.
 */
export class LegacyBm25SearchEngine implements SearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const body = buildLegacyBm25SearchBody(query);
    const response = await this.client.search(this.config.indexName, body);
    return toSearchResults(response as OpenSearchSearchResponse);
  }
}
