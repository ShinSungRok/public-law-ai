export interface OpenSearchLegalDocument {
  id: string;
  documentType: string;
  title: string;
  text: string;
  sourceType: string;
  sourceId: string;
  /** Dense vector for kNN retrieval; absent for keyword-only indexed documents. */
  embedding?: number[];
}
