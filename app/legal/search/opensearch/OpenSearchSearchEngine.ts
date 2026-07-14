import type { SearchEngine } from "../SearchEngine";
import type { SearchHit } from "../SearchHit";
import type { SearchQuery } from "../SearchQuery";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import { buildOpenSearchKeywordSearchBody } from "./OpenSearchSearchBodyBuilder";
import {
  isOpenSearchSearchResponse,
  toSearchResults,
} from "./OpenSearchSearchResponseMapper";

export class OpenSearchSearchEngine implements SearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const body = buildOpenSearchKeywordSearchBody(query);
    const response = await this.client.search(this.config.indexName, body);

    if (!isOpenSearchSearchResponse(response)) {
      return [];
    }

    return toSearchResults(response);
  }
}
