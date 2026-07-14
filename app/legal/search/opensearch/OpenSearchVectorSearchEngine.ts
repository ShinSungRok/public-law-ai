import type { EmbeddingProvider } from "../../embedding/EmbeddingProvider";
import type { SearchHit } from "../SearchHit";
import type { SearchQuery } from "../SearchQuery";
import type { VectorSearchEngine } from "../VectorSearchEngine";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import { buildOpenSearchVectorSearchBody } from "./OpenSearchVectorSearchBodyBuilder";
import {
  isOpenSearchSearchResponse,
  toSearchResults,
} from "./OpenSearchSearchResponseMapper";

/**
 * Vector counterpart to OpenSearchSearchEngine: embeds the query text via an
 * EmbeddingProvider, runs a k-NN search body against the same OpenSearchClient/
 * index, and maps the response with the same unmodified toSearchResults —
 * only the query body construction differs from the keyword engine.
 */
export class OpenSearchVectorSearchEngine implements VectorSearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
    private readonly embeddingProvider: EmbeddingProvider,
  ) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const queryVector = await this.embeddingProvider.embed(query.text);
    const body = buildOpenSearchVectorSearchBody(queryVector, query.limit);
    const response = await this.client.search(this.config.indexName, body);

    if (!isOpenSearchSearchResponse(response)) {
      return [];
    }

    return toSearchResults(response);
  }
}
