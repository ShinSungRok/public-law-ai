import { Client } from "@opensearch-project/opensearch";
import { OpenSearchBulkIndexError } from "./OpenSearchBulkIndexError";
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
    if (documents.length === 0) {
      return;
    }

    const body: Record<string, unknown>[] = [];
    for (const document of documents) {
      body.push({ index: { _id: document.id } });
      body.push(document as unknown as Record<string, unknown>);
    }

    const response = await this.client.bulk({ index: indexName, body });

    if (response.body.errors) {
      const failedDocumentIds = response.body.items
        .map((item) => item.index)
        .filter((result) => result !== undefined && result.error !== undefined)
        .map((result) => result._id ?? "unknown");

      throw new OpenSearchBulkIndexError(failedDocumentIds);
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
