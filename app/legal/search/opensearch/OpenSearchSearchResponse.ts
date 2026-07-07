import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

export interface OpenSearchHit {
  _id: string;
  _score?: number;
  _source?: OpenSearchLegalDocument;
}

export interface OpenSearchSearchResponse {
  hits: {
    hits: OpenSearchHit[];
  };
}
