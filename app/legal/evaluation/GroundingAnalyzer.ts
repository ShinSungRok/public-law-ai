const CLAIM_SPLIT_PATTERN = /[.!?\n]+/;
const TOKEN_STRIP_PATTERN = /[.,!?"'()[\]{}:;]/g;
const CLAIM_SUPPORT_THRESHOLD = 0.6;
const VACUOUS_RATIO = 1;

export interface GroundingClaimAnalysis {
  claim: string;
  overlapRatio: number;
  supported: boolean;
}

function splitIntoClaims(answer: string): string[] {
  return answer
    .split(CLAIM_SPLIT_PATTERN)
    .map((claim) => claim.trim())
    .filter((claim) => claim.length > 0);
}

function tokenize(text: string): string[] {
  return text
    .replace(TOKEN_STRIP_PATTERN, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

/**
 * Fraction of a claim's tokens that appear (case-insensitive substring
 * match) somewhere in the retrieved context text. 1 (vacuous) for a claim
 * with no meaningful tokens — mirrors the vacuous-score convention already
 * used by RetrievalMetricsCalculator for "nothing to check".
 */
export function computeClaimOverlapRatio(claim: string, contextText: string): number {
  const claimTokens = tokenize(claim);
  if (claimTokens.length === 0) {
    return VACUOUS_RATIO;
  }

  const normalizedContext = contextText.toLowerCase();
  const supportedTokenCount = claimTokens.filter((token) =>
    normalizedContext.includes(token),
  ).length;

  return supportedTokenCount / claimTokens.length;
}

/**
 * Splits an answer into sentence-level claims and classifies each as
 * supported (its token-overlap ratio with the retrieved context text meets
 * CLAIM_SUPPORT_THRESHOLD) or unsupported. Deterministic substring/token
 * overlap only — no semantic similarity or LLM-as-a-judge, consistent with
 * every other evaluator in this framework (see docs/evaluation.md's "Why
 * semantic evaluation is deferred" / "Why LLM-as-a-Judge is deferred").
 */
export function analyzeClaims(
  answer: string,
  contextText: string,
): GroundingClaimAnalysis[] {
  return splitIntoClaims(answer).map((claim) => {
    const overlapRatio = computeClaimOverlapRatio(claim, contextText);
    return {
      claim,
      overlapRatio,
      supported: overlapRatio >= CLAIM_SUPPORT_THRESHOLD,
    };
  });
}
