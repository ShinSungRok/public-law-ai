export const RETRIEVAL_FAILURE_CATEGORIES = [
  "missing-indexed-content",
  "query-wording-mismatch",
  "retrieved-outside-top-5",
  "similar-article-competition",
  "wrong-document-ranked-higher",
  "expected-document-not-retrieved",
  "other",
] as const;

export type RetrievalFailureCategory = (typeof RETRIEVAL_FAILURE_CATEGORIES)[number];
