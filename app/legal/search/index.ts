export type { SearchEngine } from "./SearchEngine";
export type { SearchQuery } from "./SearchQuery";
export type { SearchResult } from "./SearchResult";
export { KeywordSearchEngine } from "./KeywordSearchEngine";
export { toRetrievalResult } from "./SearchResultMapper";
export type {
  OpenSearchConfig,
  OpenSearchLegalDocument,
  OpenSearchClient,
  OpenSearchHit,
  OpenSearchSearchResponse,
} from "./opensearch";
export {
  toOpenSearchLegalDocument,
  OPEN_SEARCH_LEGAL_INDEX_MAPPING,
  OpenSearchIndexManager,
  OpenSearchLegalDocumentIndexer,
  buildOpenSearchKeywordSearchBody,
  OpenSearchSearchEngine,
  FakeOpenSearchClient,
  toSearchResults,
} from "./opensearch";
