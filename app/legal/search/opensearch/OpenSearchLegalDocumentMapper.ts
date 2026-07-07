import type { LegalDocument } from "../../domain/LegalDocument";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

export function toOpenSearchLegalDocument(
  document: LegalDocument,
): OpenSearchLegalDocument {
  return {
    id: document.id,
    documentType: document.documentType,
    title: document.title,
    text: document.text,
    sourceType: document.sourceRef.sourceType,
    sourceId: document.sourceRef.sourceId,
  };
}
