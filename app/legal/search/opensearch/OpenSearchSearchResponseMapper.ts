import type { LegalDocument, LegalSourceRefType } from "../../domain/LegalDocument";
import type { LegalDocumentType } from "../../domain/LegalDocumentType";
import type { SearchResult } from "../SearchResult";
import type { OpenSearchHit, OpenSearchSearchResponse } from "./OpenSearchSearchResponse";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

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

function toSearchResult(hit: OpenSearchHit): SearchResult | null {
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
): SearchResult[] {
  return response.hits.hits
    .map(toSearchResult)
    .filter((result): result is SearchResult => result !== null);
}
