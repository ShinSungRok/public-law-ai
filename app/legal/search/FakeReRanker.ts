import type { ReRanker } from "./ReRanker";
import type { SearchHit } from "./SearchHit";
import type { SearchQuery } from "./SearchQuery";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0);
}

function overlapScore(queryTerms: string[], hit: SearchHit): number {
  const documentTerms = new Set(
    tokenize(`${hit.document.title} ${hit.document.text}`),
  );
  return queryTerms.reduce(
    (count, term) => count + (documentTerms.has(term) ? 1 : 0),
    0,
  );
}

/**
 * Deterministic stand-in for a real cross-encoder/LLM re-ranker: scores each
 * candidate by exact query-term overlap against its title+text, breaking
 * ties by the candidate's original rank from the candidate source so
 * ordering never depends on object identity or iteration order.
 */
export class FakeReRanker implements ReRanker {
  async rerank(
    query: SearchQuery,
    candidates: SearchHit[],
  ): Promise<SearchHit[]> {
    const queryTerms = tokenize(query.text);

    const scored = candidates.map((candidate, originalRank) => ({
      candidate,
      originalRank,
      score: overlapScore(queryTerms, candidate),
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.originalRank - b.originalRank;
    });

    return scored.map(({ candidate, score }) => ({ ...candidate, score }));
  }
}
