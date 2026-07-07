import type { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { SearchEngine } from "./SearchEngine";
import type { SearchQuery } from "./SearchQuery";
import type { SearchResult } from "./SearchResult";

export class KeywordSearchEngine implements SearchEngine {
  constructor(private readonly retriever: KeywordRetriever) {}

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const retrievalResult = await this.retriever.retrieve(query.text);

    return retrievalResult.documents.map((retrievedDocument) => ({
      id: retrievedDocument.document.id,
      score: retrievedDocument.score,
      highlights: [],
      matchedFields: retrievedDocument.matchedTerms,
      metadata: { ...retrievedDocument.document.metadata },
    }));
  }
}
