import type { SearchEngine } from "../SearchEngine";
import type { SearchQuery } from "../SearchQuery";
import type { SearchResult } from "../SearchResult";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import { buildOpenSearchKeywordSearchBody } from "./OpenSearchSearchBodyBuilder";

export class OpenSearchSearchEngine implements SearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const body = buildOpenSearchKeywordSearchBody(query);
    await this.client.search(this.config.indexName, body);

    return [];
  }
}
