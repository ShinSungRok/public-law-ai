export class OpenSearchBulkIndexError extends Error {
  constructor(public readonly failedDocumentIds: string[]) {
    super(`OpenSearch bulk index failed for documents: ${failedDocumentIds.join(", ")}`);
    this.name = "OpenSearchBulkIndexError";
  }
}
