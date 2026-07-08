import { Client } from "@opensearch-project/opensearch";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

export class OpenSearchSdkClient implements OpenSearchClient {
  private readonly client: Client;

  constructor(config: OpenSearchConfig) {
    this.client = new Client({
      node: config.node,
      auth:
        config.username !== undefined && config.password !== undefined
          ? { username: config.username, password: config.password }
          : undefined,
    });
  }

  async createIndex(indexName: string, mapping: unknown): Promise<void> {
    await this.client.indices.create({
      index: indexName,
      body: mapping as Record<string, unknown>,
    });
  }

  async indexDocument(
    indexName: string,
    id: string,
    document: OpenSearchLegalDocument,
  ): Promise<void> {
    await this.client.index({
      index: indexName,
      id,
      body: document,
    });
  }

  async bulkIndex(
    indexName: string,
    documents: OpenSearchLegalDocument[],
  ): Promise<void> {
    for (const document of documents) {
      await this.indexDocument(indexName, document.id, document);
    }
  }

  async search(indexName: string, body: unknown): Promise<unknown> {
    const response = await this.client.search({
      index: indexName,
      body: body as Record<string, unknown>,
    });

    return response.body;
  }
}
