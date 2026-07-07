import type { LegalSourceRefType } from "./LegalDocument";

export interface Citation {
  id: string;
  sourceType: LegalSourceRefType;
  sourceId: string;
  displayText: string;
  sourceUrl: string;
  snippet: string;
}
