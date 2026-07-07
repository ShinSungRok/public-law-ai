export interface SearchQuery {
  text: string;
  limit?: number;
  filters?: Record<string, unknown>;
}
