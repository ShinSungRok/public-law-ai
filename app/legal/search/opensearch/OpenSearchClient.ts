import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

export interface OpenSearchClient {
  indexExists(indexName: string): Promise<boolean>;
  createIndex(indexName: string, mapping: unknown): Promise<void>;
  indexDocument(
    indexName: string,
    id: string,
    document: OpenSearchLegalDocument,
  ): Promise<void>;
  bulkIndex(
    indexName: string,
    documents: OpenSearchLegalDocument[],
  ): Promise<void>;
  search(indexName: string, body: unknown): Promise<unknown>;
}
