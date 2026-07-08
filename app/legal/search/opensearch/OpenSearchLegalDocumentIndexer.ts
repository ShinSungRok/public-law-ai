import type { LegalDocument } from "../../domain/LegalDocument";
import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import { toOpenSearchLegalDocument } from "./OpenSearchLegalDocumentMapper";

export class OpenSearchLegalDocumentIndexer {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async index(document: LegalDocument): Promise<void> {
    const converted = toOpenSearchLegalDocument(document);
    await this.client.indexDocument(
      this.config.indexName,
      converted.id,
      converted,
    );
  }

  async indexAll(
    documents: LegalDocument[],
    batchSize: number = 100,
  ): Promise<void> {
    for (let offset = 0; offset < documents.length; offset += batchSize) {
      const chunk = documents.slice(offset, offset + batchSize);
      for (const document of chunk) {
        await this.index(document);
      }
    }
  }
}
