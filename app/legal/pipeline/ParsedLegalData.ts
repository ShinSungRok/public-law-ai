import type { LegalDocument } from "../domain";

export interface ParsedLegalData {
  sourceSystem: string;
  sourceId: string;
  document: LegalDocument;
}
