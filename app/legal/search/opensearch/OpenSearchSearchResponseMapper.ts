import type { LegalDocument, LegalSourceRefType } from "../../domain/LegalDocument";
import type { LegalDocumentType } from "../../domain/LegalDocumentType";
import type { SearchHit } from "../SearchHit";
import type { OpenSearchHit, OpenSearchSearchResponse } from "./OpenSearchSearchResponse";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

/** Shared by every OpenSearchClient.search() caller (keyword, vector, ...) to validate the raw response shape before mapping it. */
export function isOpenSearchSearchResponse(
  value: unknown,
): value is OpenSearchSearchResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "hits" in value &&
    typeof (value as { hits: unknown }).hits === "object" &&
    (value as { hits: unknown }).hits !== null
  );
}

function toLegalDocument(source: OpenSearchLegalDocument): LegalDocument {
  return {
    id: source.id,
    documentType: source.documentType as LegalDocumentType,
    title: source.title,
    text: source.text,
    metadata: {
      sourceSystem: "",
      sourceId: "",
      sourceUrl: "",
      retrievedAt: "",
    },
    sourceRef: {
      sourceType: source.sourceType as LegalSourceRefType,
      sourceId: source.sourceId,
    },
  };
}

function toSearchResult(hit: OpenSearchHit): SearchHit | null {
  if (!hit._source) {
    return null;
  }

  return {
    id: hit._id,
    document: toLegalDocument(hit._source),
    score: hit._score ?? 0,
    highlights: [],
    matchedFields: [],
    metadata: {},
  };
}

export function toSearchResults(
  response: OpenSearchSearchResponse,
): SearchHit[] {
  return response.hits.hits
    .map(toSearchResult)
    .filter((result): result is SearchHit => result !== null);
}
