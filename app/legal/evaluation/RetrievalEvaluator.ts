import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationResult } from "./EvaluationResult";
import type { RetrievalTestCase } from "./RetrievalTestCase";

function computePrecision(expected: string[], retrieved: string[]): number {
  if (retrieved.length === 0) {
    return 0;
  }

  const expectedIds = new Set(expected);
  const relevantRetrieved = retrieved.filter((id) => expectedIds.has(id));
  return relevantRetrieved.length / retrieved.length;
}

function computeRecall(expected: string[], retrieved: string[]): number {
  if (expected.length === 0) {
    return 1;
  }

  const retrievedIds = new Set(retrieved);
  const foundExpected = expected.filter((id) => retrievedIds.has(id));
  return foundExpected.length / expected.length;
}

export class RetrievalEvaluator {
  constructor(private readonly retriever: Retriever) {}

  async evaluate(testCase: RetrievalTestCase): Promise<EvaluationResult> {
    const retrievalResult = await this.retriever.retrieve(testCase.query);
    const retrievedDocumentIds = retrievalResult.documents.map(
      (retrievedDocument) => retrievedDocument.document.id,
    );

    const precision = computePrecision(
      testCase.expectedDocumentIds,
      retrievedDocumentIds,
    );
    const recall = computeRecall(
      testCase.expectedDocumentIds,
      retrievedDocumentIds,
    );

    return {
      query: testCase.query,
      expectedDocumentIds: testCase.expectedDocumentIds,
      retrievedDocumentIds,
      precision,
      recall,
      passed: recall === 1,
    };
  }
}
