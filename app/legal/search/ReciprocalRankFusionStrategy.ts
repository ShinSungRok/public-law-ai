import type { SearchResult } from "./model/SearchResult";
import type { ScoreFusionStrategy } from "./ScoreFusionStrategy";

const DEFAULT_K = 60;

export class ReciprocalRankFusionStrategy implements ScoreFusionStrategy {
  constructor(private readonly k: number = DEFAULT_K) {}

  fuse(resultGroups: SearchResult[][]): SearchResult[] {
    const fusedScoreByDocumentId = new Map<string, number>();

    for (const group of resultGroups) {
      const ranked = [...group].sort((a, b) => b.score - a.score);
      ranked.forEach((result, index) => {
        const rank = index + 1;
        const contribution = 1 / (this.k + rank);
        const currentScore = fusedScoreByDocumentId.get(result.document.id) ?? 0;
        fusedScoreByDocumentId.set(
          result.document.id,
          currentScore + contribution,
        );
      });
    }

    const fused = resultGroups.flat().map((result) => ({
      ...result,
      score: fusedScoreByDocumentId.get(result.document.id) ?? 0,
    }));

    return fused.sort((a, b) => b.score - a.score);
  }
}
