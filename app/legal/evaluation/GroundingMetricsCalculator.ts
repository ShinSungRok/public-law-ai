import type { GroundingClaimAnalysis } from "./GroundingAnalyzer";
import { computeRecallAtK } from "./RetrievalMetricsCalculator";

const VACUOUS_SCORE = 1;

/**
 * Fraction of the evaluation case's expected documents that are present
 * anywhere in the context actually retrieved for this run. Reuses
 * RetrievalMetricsCalculator.computeRecallAtK (k = the full retrieved list
 * length, i.e. unrestricted recall) rather than reimplementing document-id
 * matching.
 */
export function computeContextCoverage(
  expectedDocumentIds: string[],
  retrievedDocumentIds: string[],
): number {
  return computeRecallAtK(
    expectedDocumentIds,
    retrievedDocumentIds,
    retrievedDocumentIds.length,
  );
}

/** Fraction of the answer's claims that are grounded in retrieved context. 1 (vacuous) for an answer with no claims. */
export function computeGroundedAnswerScore(claims: GroundingClaimAnalysis[]): number {
  if (claims.length === 0) {
    return VACUOUS_SCORE;
  }
  return claims.filter((claim) => claim.supported).length / claims.length;
}

/** Raw count of claims that could not be grounded in retrieved context — a diagnostic count, not a normalized score. */
export function computeUnsupportedClaimCount(claims: GroundingClaimAnalysis[]): number {
  return claims.filter((claim) => !claim.supported).length;
}

/** Fraction of citations whose source document was actually part of the retrieved context. 1 (vacuous) when there are no citations to verify. */
export function computeCitationCoverage(
  citationSourceIds: string[],
  retrievedDocumentIds: string[],
): number {
  if (citationSourceIds.length === 0) {
    return VACUOUS_SCORE;
  }

  const retrievedIdSet = new Set(retrievedDocumentIds);
  const supportedCount = citationSourceIds.filter((id) => retrievedIdSet.has(id)).length;
  return supportedCount / citationSourceIds.length;
}
