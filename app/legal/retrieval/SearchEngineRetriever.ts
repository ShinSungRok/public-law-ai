import type { SearchEngine } from "../search/SearchEngine";
import { toRetrievalResult } from "../search/SearchResultMapper";
import type { RetrievalResult } from "./RetrievalResult";
import type { Retriever } from "./Retriever";

export class SearchEngineRetriever implements Retriever {
  constructor(private readonly searchEngine: SearchEngine) {}

  async retrieve(query: string): Promise<RetrievalResult> {
    const searchResults = await this.searchEngine.search({ text: query });

    const documents = searchResults.flatMap(
      (searchResult) => toRetrievalResult(searchResult).documents,
    );

    return { query, documents };
  }
}
