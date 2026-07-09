export function computePrecision(expected: string[], retrieved: string[]): number {
  if (retrieved.length === 0) {
    return 0;
  }

  const expectedIds = new Set(expected);
  const relevantRetrieved = retrieved.filter((id) => expectedIds.has(id));
  return relevantRetrieved.length / retrieved.length;
}

export function computeRecall(expected: string[], retrieved: string[]): number {
  if (expected.length === 0) {
    return 1;
  }

  const retrievedIds = new Set(retrieved);
  const foundExpected = expected.filter((id) => retrievedIds.has(id));
  return foundExpected.length / expected.length;
}
