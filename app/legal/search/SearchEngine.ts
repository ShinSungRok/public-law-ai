import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

export interface SearchEngine {
  search(query: SearchQuery): Promise<SearchHit[]>;
}
