import type {
  RetrievalResult,
  RetrievedDocument,
} from "../retrieval/RetrievalResult";
import type { SearchResult } from "./SearchResult";

export function toRetrievalResult(searchResult: SearchResult): RetrievalResult {
  const retrievedDocument: RetrievedDocument = {
    document: searchResult.document,
    score: searchResult.score,
    matchedTerms: [],
  };

  return {
    query: "",
    documents: [retrievedDocument],
  };
}
