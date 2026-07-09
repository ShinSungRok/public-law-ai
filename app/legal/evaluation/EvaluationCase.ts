import type { EvaluationTarget } from "./EvaluationTarget";

export interface EvaluationCase {
  id: string;
  name: string;
  target: EvaluationTarget;
  query: string;
  expectedDocumentIds?: string[];
  expectedAnswerKeywords?: string[];
  expectedCitationDocumentIds?: string[];
  metadata?: Record<string, unknown>;
}
