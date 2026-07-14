import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

/** A SearchEngine specialized for vector/kNN retrieval; assignable anywhere a SearchEngine is expected (e.g. SearchEngineRetriever). */
export interface VectorSearchEngine {
  search(query: SearchQuery): Promise<SearchHit[]>;
}
