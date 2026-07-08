import type { ParsedLegalData } from "../pipeline/ParsedLegalData";
import type { LegalDocumentEntity } from "./LegalDocumentEntity";

export function toLegalDocumentEntity(
  parsed: ParsedLegalData,
): LegalDocumentEntity {
  const now = new Date().toISOString();

  return {
    id: `${parsed.sourceSystem}:${parsed.document.id}`,
    source: parsed.sourceSystem,
    documentId: parsed.document.id,
    title: parsed.document.title,
    content: parsed.document.text,
    rawData: JSON.stringify(parsed.document),
    createdAt: now,
    updatedAt: now,
  };
}
