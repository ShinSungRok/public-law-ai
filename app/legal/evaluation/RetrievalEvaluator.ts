import type { Retriever } from "../retrieval/Retriever";
import { computePrecision, computeRecall } from "./PrecisionRecallCalculator";
import type { RetrievalEvaluationResult } from "./RetrievalEvaluationResult";
import type { RetrievalTestCase } from "./RetrievalTestCase";

export class RetrievalEvaluator {
  constructor(private readonly retriever: Retriever) {}

  async evaluate(testCase: RetrievalTestCase): Promise<RetrievalEvaluationResult> {
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
