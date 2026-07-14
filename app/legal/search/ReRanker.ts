import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

export interface ReRanker {
  rerank(query: SearchQuery, candidates: SearchHit[]): Promise<SearchHit[]>;
}
