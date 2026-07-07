import type { SearchQuery } from "../SearchQuery";

const DEFAULT_SIZE = 10;

export function buildOpenSearchKeywordSearchBody(query: SearchQuery): unknown {
  return {
    size: query.limit ?? DEFAULT_SIZE,
    query: {
      multi_match: {
        query: query.text,
        fields: ["title", "text"],
      },
    },
  };
}
