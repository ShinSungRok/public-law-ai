import type { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { SearchEngine } from "./SearchEngine";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

export class KeywordSearchEngine implements SearchEngine {
  constructor(private readonly retriever: KeywordRetriever) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const retrievalResult = await this.retriever.retrieve(query.text);

    return retrievalResult.documents.map((retrievedDocument) => ({
      id: retrievedDocument.document.id,
      document: retrievedDocument.document,
      score: retrievedDocument.score,
      highlights: [],
      matchedFields: retrievedDocument.matchedTerms,
      metadata: { ...retrievedDocument.document.metadata },
    }));
  }
}
