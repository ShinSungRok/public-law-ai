import type { LegalDocument } from "../../domain/LegalDocument";
import type { SearchSource } from "./SearchSource";

export interface SearchResult {
  document: LegalDocument;
  score: number;
  source: SearchSource;
}
