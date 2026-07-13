const VACUOUS_SCORE = 1;
const NO_HIT_SCORE = 0;

/**
 * A case with no expected documents (e.g. a negative/out-of-domain case)
 * has nothing to recall — treated as vacuously satisfied (mirrors
 * PrecisionRecallCalculator.computeRecall's existing convention). Callers
 * that aggregate across a dataset should exclude such cases explicitly
 * rather than average this placeholder in (see RetrievalMetricsReport.ts).
 */
function isVacuous(expected: string[]): boolean {
  return expected.length === 0;
}

/** 1 if any expected document appears anywhere in the retrieved list, else 0. */
export function computeHit(expected: string[], retrieved: string[]): number {
  if (isVacuous(expected)) {
    return VACUOUS_SCORE;
  }
  const retrievedIds = new Set(retrieved);
  return expected.some((id) => retrievedIds.has(id)) ? 1 : NO_HIT_SCORE;
}

/** Fraction of expected documents found within the top K retrieved results. */
export function computeRecallAtK(
  expected: string[],
  retrieved: string[],
  k: number,
): number {
  if (isVacuous(expected)) {
    return VACUOUS_SCORE;
  }
  const topK = new Set(retrieved.slice(0, k));
  const found = expected.filter((id) => topK.has(id));
  return found.length / expected.length;
}

/** 1 / (1-indexed rank of the first expected document found), or 0 if none is found. */
export function computeReciprocalRank(expected: string[], retrieved: string[]): number {
  if (isVacuous(expected)) {
    return VACUOUS_SCORE;
  }
  const expectedIds = new Set(expected);
  for (let index = 0; index < retrieved.length; index += 1) {
    if (expectedIds.has(retrieved[index])) {
      return 1 / (index + 1);
    }
  }
  return NO_HIT_SCORE;
}
