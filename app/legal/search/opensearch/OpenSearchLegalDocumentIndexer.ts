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
    const totalBatchCount = Math.ceil(documents.length / batchSize);
    console.log(`[indexAll] Total documents: ${documents.length}`);

    let indexedCount = 0;
    const failedDocumentIds: string[] = [];
    for (let offset = 0; offset < documents.length; offset += batchSize) {
      const batchNumber = offset / batchSize + 1;
      console.log(`[indexAll] Batch ${batchNumber}/${totalBatchCount}`);

      const chunk = documents.slice(offset, offset + batchSize);
      const convertedChunk = chunk.map(toOpenSearchLegalDocument);

      let succeeded = false;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          await this.client.bulkIndex(this.config.indexName, convertedChunk);
          succeeded = true;
          break;
        } catch {
          // retry until maxRetries is exhausted
        }
      }
      if (succeeded) {
        indexedCount += chunk.length;
      } else {
        failedDocumentIds.push(...chunk.map((document) => document.id));
      }

      console.log(
        `[indexAll] Batch ${batchNumber}/${totalBatchCount} done. indexedCount: ${indexedCount}, failedCount: ${failedDocumentIds.length}`,
      );
    }

    const result: OpenSearchBatchIndexResult = {
      totalCount: documents.length,
      indexedCount,
      failedCount: failedDocumentIds.length,
      failedDocumentIds,
    };
    console.log("[indexAll] Final result:", result);
    return result;
  }
}
