import { buildCitation } from "../citation/CitationBuilder";
import type { Citation } from "../domain";
import type { SearchResult } from "../search/model/SearchResult";
import type { CitationExtractor } from "./CitationExtractor";

export class DefaultCitationExtractor implements CitationExtractor {
  extract(results: SearchResult[]): Citation[] {
    return results
      .filter((result) => Boolean(result.document?.sourceRef))
      .map((result) => buildCitation(result.document));
  }
}
