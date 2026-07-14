export type { OpenSearchBatchIndexOptions } from "./OpenSearchBatchIndexOptions";
export type { OpenSearchBatchIndexResult } from "./OpenSearchBatchIndexResult";
export { OpenSearchBulkIndexError } from "./OpenSearchBulkIndexError";
export type { OpenSearchConfig } from "./OpenSearchConfig";
export {
  createOpenSearchConfigFromEnv,
  shouldUseOpenSearchEngine,
} from "./OpenSearchConfigFactory";
export type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";
export { toOpenSearchLegalDocument } from "./OpenSearchLegalDocumentMapper";
export { OPEN_SEARCH_LEGAL_INDEX_MAPPING } from "./OpenSearchLegalIndexMapping";
export type { OpenSearchClient } from "./OpenSearchClient";
export { OpenSearchIndexManager } from "./OpenSearchIndexManager";
export { OpenSearchLegalDocumentIndexer } from "./OpenSearchLegalDocumentIndexer";
export { buildOpenSearchKeywordSearchBody } from "./OpenSearchSearchBodyBuilder";
export { buildOpenSearchVectorSearchBody } from "./OpenSearchVectorSearchBodyBuilder";
export { OpenSearchSearchEngine } from "./OpenSearchSearchEngine";
export { OpenSearchVectorSearchEngine } from "./OpenSearchVectorSearchEngine";
export type {
  OpenSearchHit,
  OpenSearchSearchResponse,
} from "./OpenSearchSearchResponse";
export { FakeOpenSearchClient } from "./FakeOpenSearchClient";
export {
  isOpenSearchSearchResponse,
  toSearchResults,
} from "./OpenSearchSearchResponseMapper";
export { OpenSearchSdkClient } from "./OpenSearchSdkClient";
