import type { Retriever } from "../retrieval/Retriever";
import {
  computeHit,
  computeRecallAtK,
  computeReciprocalRank,
} from "./RetrievalMetricsCalculator";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";

export const HIT_RATE_METRIC_NAME = "hit-rate";
export const RECALL_AT_1_METRIC_NAME = "recall@1";
export const RECALL_AT_3_METRIC_NAME = "recall@3";
export const RECALL_AT_5_METRIC_NAME = "recall@5";
export const MRR_METRIC_NAME = "mrr";

const RECALL_K_1 = 1;
const RECALL_K_3 = 3;
const RECALL_K_5 = 5;
const PERFECT_SCORE = 1;

function summarize(results: EvaluationResult[]): EvaluationSummary {
  const passedCount = results.filter((result) => result.passed).length;

  return {
    totalCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
  };
}

/**
 * Measures retrieval quality (Hit Rate, Recall@1/3/5, MRR) for the
 * `retrieval`-target cases in the RAG evaluation dataset. Wraps the
 * existing `Retriever` interface unchanged — this only measures, it never
 * alters retrieval behavior.
 */
export class RetrievalMetricsEvaluationRunner implements EvaluationRunner {
  constructor(private readonly retriever: Retriever) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const expectedDocumentIds = evaluationCase.expectedDocumentIds ?? [];
    const retrievalResult = await this.retriever.retrieve(evaluationCase.query);
    const retrievedDocumentIds = retrievalResult.documents.map(
      (retrievedDocument) => retrievedDocument.document.id,
    );

    const hit = computeHit(expectedDocumentIds, retrievedDocumentIds);
    const recallAt1 = computeRecallAtK(expectedDocumentIds, retrievedDocumentIds, RECALL_K_1);
    const recallAt3 = computeRecallAtK(expectedDocumentIds, retrievedDocumentIds, RECALL_K_3);
    const recallAt5 = computeRecallAtK(expectedDocumentIds, retrievedDocumentIds, RECALL_K_5);
    const reciprocalRank = computeReciprocalRank(expectedDocumentIds, retrievedDocumentIds);

    const metrics: EvaluationMetric[] = [
      {
        name: HIT_RATE_METRIC_NAME,
        score: hit,
        passed: hit === PERFECT_SCORE,
        details: `retrieved ${retrievedDocumentIds.length} document(s)`,
      },
      { name: RECALL_AT_1_METRIC_NAME, score: recallAt1, passed: recallAt1 === PERFECT_SCORE },
      { name: RECALL_AT_3_METRIC_NAME, score: recallAt3, passed: recallAt3 === PERFECT_SCORE },
      { name: RECALL_AT_5_METRIC_NAME, score: recallAt5, passed: recallAt5 === PERFECT_SCORE },
      { name: MRR_METRIC_NAME, score: reciprocalRank, passed: reciprocalRank === PERFECT_SCORE },
    ];

    return {
      caseId: evaluationCase.id,
      target: "retrieval",
      passed: hit === PERFECT_SCORE,
      metrics,
    };
  }

  async runMany(evaluationCases: EvaluationCase[]): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];
    for (const evaluationCase of evaluationCases) {
      results.push(await this.run(evaluationCase));
    }

    return summarize(results);
  }
}
