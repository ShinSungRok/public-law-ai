import type { Citation } from "../domain/Citation";
import type { LegalDocument } from "../domain/LegalDocument";
import type { RetrievedDocument } from "../retrieval/RetrievalResult";

function firstNonEmptyLine(text: string): string {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return "";
}

export function buildCitation(document: LegalDocument): Citation {
  return {
    id: `citation:${document.id}`,
    sourceType: document.sourceRef.sourceType,
    sourceId: document.sourceRef.sourceId,
    displayText: document.title,
    sourceUrl: document.metadata.sourceUrl,
    snippet: firstNonEmptyLine(document.text),
  };
}

export function buildCitationsFromRetrievedDocuments(
  retrievedDocuments: RetrievedDocument[],
): Citation[] {
  return retrievedDocuments.map((retrievedDocument) =>
    buildCitation(retrievedDocument.document),
  );
}
