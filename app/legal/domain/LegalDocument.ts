import type { LegalDocumentType } from "./LegalDocumentType";
import type { LegalSourceMetadata } from "./LegalSourceMetadata";

export type LegalSourceRefType = "statute_article" | "court_case";

export interface LegalDocumentSourceRef {
  sourceType: LegalSourceRefType;
  sourceId: string;
}

export interface LegalDocument {
  id: string;
  documentType: LegalDocumentType;
  title: string;
  text: string;
  metadata: LegalSourceMetadata;
  sourceRef: LegalDocumentSourceRef;
}
