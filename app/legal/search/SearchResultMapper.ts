import type {
  RetrievalResult,
  RetrievedDocument,
} from "../retrieval/RetrievalResult";
import type { SearchHit } from "./SearchHit";

export function toRetrievalResult(searchHit: SearchHit): RetrievalResult {
  const retrievedDocument: RetrievedDocument = {
    document: searchHit.document,
    score: searchHit.score,
    matchedTerms: [],
  };

  return {
    query: "",
    documents: [retrievedDocument],
  };
}
