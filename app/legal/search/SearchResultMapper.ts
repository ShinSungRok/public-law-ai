import type { LegalDocument } from "../domain/LegalDocument";
import type { LegalDocumentType } from "../domain/LegalDocumentType";
import type { LegalSourceMetadata } from "../domain/LegalSourceMetadata";
import type {
  RetrievalResult,
  RetrievedDocument,
} from "../retrieval/RetrievalResult";
import type { SearchResult } from "./SearchResult";

const DEFAULT_DOCUMENT_TYPE: LegalDocumentType = "STATUTE_ARTICLE";

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function toLegalSourceMetadata(
  metadata: Record<string, unknown>,
): LegalSourceMetadata {
  return {
    sourceSystem: readMetadataString(metadata, "sourceSystem"),
    sourceId: readMetadataString(metadata, "sourceId"),
    sourceUrl: readMetadataString(metadata, "sourceUrl"),
    retrievedAt: readMetadataString(metadata, "retrievedAt"),
  };
}

function toLegalDocument(searchResult: SearchResult): LegalDocument {
  return {
    id: searchResult.id,
    documentType: DEFAULT_DOCUMENT_TYPE,
    title: "",
    text: "",
    metadata: toLegalSourceMetadata(searchResult.metadata),
    sourceRef: {
      sourceType: "statute_article",
      sourceId: searchResult.id,
    },
  };
}

export function toRetrievalResult(searchResult: SearchResult): RetrievalResult {
  const retrievedDocument: RetrievedDocument = {
    document: toLegalDocument(searchResult),
    score: searchResult.score,
    matchedTerms: [],
  };

  return {
    query: "",
    documents: [retrievedDocument],
  };
}
