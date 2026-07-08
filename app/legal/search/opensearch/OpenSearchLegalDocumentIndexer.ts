import type { LegalDocument } from "../../domain/LegalDocument";
import type { OpenSearchBatchIndexOptions } from "./OpenSearchBatchIndexOptions";
import type { OpenSearchBatchIndexResult } from "./OpenSearchBatchIndexResult";
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
    options: OpenSearchBatchIndexOptions = {},
  ): Promise<OpenSearchBatchIndexResult> {
    const { batchSize = 100, maxRetries = 0 } = options;
    let indexedCount = 0;
    const failedDocumentIds: string[] = [];
    for (let offset = 0; offset < documents.length; offset += batchSize) {
      const chunk = documents.slice(offset, offset + batchSize);
      for (const document of chunk) {
        let succeeded = false;
        for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
          try {
            await this.index(document);
            succeeded = true;
            break;
          } catch {
            // retry until maxRetries is exhausted
          }
        }
        if (succeeded) {
          indexedCount += 1;
        } else {
          failedDocumentIds.push(document.id);
        }
      }
    }
    return {
      totalCount: documents.length,
      indexedCount,
      failedCount: failedDocumentIds.length,
      failedDocumentIds,
    };
  }
}
