export interface SearchResult {
  id: string;
  score: number;
  highlights: string[];
  matchedFields: string[];
  metadata: Record<string, unknown>;
}
