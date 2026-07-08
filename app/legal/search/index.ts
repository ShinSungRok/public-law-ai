export type { SearchEngine } from "./SearchEngine";
export type { SearchHit } from "./SearchHit";
export type { SearchQuery } from "./SearchQuery";
export { KeywordSearchEngine } from "./KeywordSearchEngine";
export {
  HybridSearchEngine,
  type HybridSearchEngineSource,
} from "./HybridSearchEngine";
export type { ScoreFusionStrategy } from "./ScoreFusionStrategy";
export { DefaultScoreFusionStrategy } from "./DefaultScoreFusionStrategy";
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
