import type { SearchResult } from "../search/model/SearchResult";
import type { CitationExtractor } from "./CitationExtractor";
import type { RagAnswer } from "./RagAnswer";

export class RagAnswerBuilder {
  constructor(private readonly citationExtractor: CitationExtractor) {}

  build(answer: string, results: SearchResult[]): RagAnswer {
    return {
      answer,
      citations: this.citationExtractor.extract(results),
    };
  }
}
