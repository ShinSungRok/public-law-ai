import type { LegalDocument } from "../domain/LegalDocument";

export interface RetrievedDocument {
  document: LegalDocument;
  score: number;
  matchedTerms: string[];
}

export interface RetrievalResult {
  query: string;
  documents: RetrievedDocument[];
}
