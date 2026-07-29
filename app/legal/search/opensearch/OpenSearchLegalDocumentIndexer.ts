import type { LegalDocument } from "../../domain/LegalDocument";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";
import type { OpenSearchBatchIndexOptions } from "./OpenSearchBatchIndexOptions";
import type { OpenSearchBatchIndexResult } from "./OpenSearchBatchIndexResult";
import { OpenSearchBulkIndexError } from "./OpenSearchBulkIndexError";
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

  /** Same keyword fields as {@link index}, plus the document's dense vector. */
  async indexWithEmbedding(
    document: LegalDocument,
    embedding: number[],
  ): Promise<void> {
    const converted = toOpenSearchLegalDocument(document, embedding);
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
    return this.indexConverted(
      documents.map((document) => toOpenSearchLegalDocument(document)),
      options,
    );
  }

  /** Same batching/retry behavior as {@link indexAll}, but each document carries its pre-computed embedding. */
  async indexAllWithEmbeddings(
    entries: Array<{ document: LegalDocument; embedding: number[] }>,
    options: OpenSearchBatchIndexOptions = {},
  ): Promise<OpenSearchBatchIndexResult> {
    return this.indexConverted(
      entries.map(({ document, embedding }) =>
        toOpenSearchLegalDocument(document, embedding),
      ),
      options,
    );
  }

  private async indexConverted(
    converted: OpenSearchLegalDocument[],
    options: OpenSearchBatchIndexOptions,
  ): Promise<OpenSearchBatchIndexResult> {
    const { batchSize = 100, maxRetries = 0 } = options;
    const totalBatchCount = Math.ceil(converted.length / batchSize);
    console.log(`[indexAll] Total documents: ${converted.length}`);

    let indexedCount = 0;
    const failedDocumentIds: string[] = [];
    for (let offset = 0; offset < converted.length; offset += batchSize) {
      const batchNumber = offset / batchSize + 1;
      console.log(`[indexAll] Batch ${batchNumber}/${totalBatchCount}`);

      let remaining = converted.slice(offset, offset + batchSize);

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        if (remaining.length === 0) {
          break;
        }
        try {
          await this.client.bulkIndex(this.config.indexName, remaining);
          indexedCount += remaining.length;
          remaining = [];
        } catch (error) {
          if (error instanceof OpenSearchBulkIndexError) {
            const failedIds = new Set(error.failedDocumentIds);
            const succeeded = remaining.filter(
              (document) => !failedIds.has(document.id),
            );
            indexedCount += succeeded.length;
            remaining = remaining.filter((document) =>
              failedIds.has(document.id),
            );
          }
          // non-bulk-index errors: retry the whole remaining set as-is
        }
      }
      failedDocumentIds.push(...remaining.map((document) => document.id));

      console.log(
        `[indexAll] Batch ${batchNumber}/${totalBatchCount} done. indexedCount: ${indexedCount}, failedCount: ${failedDocumentIds.length}`,
      );
    }

    const result: OpenSearchBatchIndexResult = {
      totalCount: converted.length,
      indexedCount,
      failedCount: failedDocumentIds.length,
      failedDocumentIds,
    };
    console.log("[indexAll] Final result:", result);
    return result;
  }
}
