export interface RetrievalEvaluationResult {
  query: string;
  expectedDocumentIds: string[];
  retrievedDocumentIds: string[];
  precision: number;
  recall: number;
  passed: boolean;
}
