import type { SearchEngine } from "../SearchEngine";
import type { SearchQuery } from "../SearchQuery";
import type { SearchResult } from "../SearchResult";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import type { OpenSearchSearchResponse } from "./OpenSearchSearchResponse";
import { buildOpenSearchKeywordSearchBody } from "./OpenSearchSearchBodyBuilder";
import { toSearchResults } from "./OpenSearchSearchResponseMapper";

function isOpenSearchSearchResponse(
  value: unknown,
): value is OpenSearchSearchResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "hits" in value &&
    typeof (value as { hits: unknown }).hits === "object" &&
    (value as { hits: unknown }).hits !== null
  );
}

export class OpenSearchSearchEngine implements SearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const body = buildOpenSearchKeywordSearchBody(query);
    const response = await this.client.search(this.config.indexName, body);

    if (!isOpenSearchSearchResponse(response)) {
      return [];
    }

    return toSearchResults(response);
  }
}
