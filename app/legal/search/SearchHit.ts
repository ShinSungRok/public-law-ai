import type { LegalDocument } from "../domain/LegalDocument";

export interface SearchHit {
  id: string;
  document: LegalDocument;
  score: number;
  highlights: string[];
  matchedFields: string[];
  metadata: Record<string, unknown>;
}
