export type { SearchEngine } from "./SearchEngine";
export type { SearchQuery } from "./SearchQuery";
export type { SearchResult } from "./SearchResult";
export { KeywordSearchEngine } from "./KeywordSearchEngine";
export { toRetrievalResult } from "./SearchResultMapper";
export type { OpenSearchConfig } from "./opensearch/OpenSearchConfig";
export type { OpenSearchLegalDocument } from "./opensearch/OpenSearchLegalDocument";
export { toOpenSearchLegalDocument } from "./opensearch/OpenSearchLegalDocumentMapper";
export { OPEN_SEARCH_LEGAL_INDEX_MAPPING } from "./opensearch/OpenSearchLegalIndexMapping";
export type { OpenSearchClient } from "./opensearch/OpenSearchClient";
export { OpenSearchIndexManager } from "./opensearch/OpenSearchIndexManager";
export { OpenSearchLegalDocumentIndexer } from "./opensearch/OpenSearchLegalDocumentIndexer";
export { buildOpenSearchKeywordSearchBody } from "./opensearch/OpenSearchSearchBodyBuilder";
export { OpenSearchSearchEngine } from "./opensearch/OpenSearchSearchEngine";
export type {
  OpenSearchHit,
  OpenSearchSearchResponse,
} from "./opensearch/OpenSearchSearchResponse";
export { FakeOpenSearchClient } from "./opensearch/FakeOpenSearchClient";
export { toSearchResults } from "./opensearch/OpenSearchSearchResponseMapper";
