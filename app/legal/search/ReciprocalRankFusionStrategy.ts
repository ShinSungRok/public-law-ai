import type { SearchResult } from "./model/SearchResult";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";

const DEFAULT_K = 60;

export class ReciprocalRankFusionStrategy implements ScoreFusionStrategy {
  constructor(private readonly k: number = DEFAULT_K) {}

  fuse(results: SearchResult[]): SearchResult[] {
    const ranked = [...results].sort((a, b) => b.score - a.score);

    const fused = ranked.map((result, index) => {
      const rank = index + 1;
      return {
        ...result,
        score: 1 / (this.k + rank),
      };
    });

    return fused.sort((a, b) => b.score - a.score);
  }
}
