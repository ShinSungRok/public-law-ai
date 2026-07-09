import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";
import { RetrievalEvaluator } from "./RetrievalEvaluator";
import type { RetrievalTestCase } from "./RetrievalTestCase";

const PRECISION_METRIC_NAME = "precision";
const RECALL_METRIC_NAME = "recall";
const PERFECT_SCORE = 1;

function toRetrievalTestCase(evaluationCase: EvaluationCase): RetrievalTestCase {
  return {
    query: evaluationCase.query,
    expectedDocumentIds: evaluationCase.expectedDocumentIds ?? [],
  };
}

function summarize(results: EvaluationResult[]): EvaluationSummary {
  const passedCount = results.filter((result) => result.passed).length;

  return {
    totalCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
  };
}

export class RetrievalEvaluationRunner implements EvaluationRunner {
  private readonly evaluator: RetrievalEvaluator;

  constructor(retriever: Retriever) {
    this.evaluator = new RetrievalEvaluator(retriever);
  }

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const retrievalEvaluationResult = await this.evaluator.evaluate(
      toRetrievalTestCase(evaluationCase),
    );

    const metrics: EvaluationMetric[] = [
      {
        name: PRECISION_METRIC_NAME,
        score: retrievalEvaluationResult.precision,
        passed: retrievalEvaluationResult.precision === PERFECT_SCORE,
        details: `retrieved ${retrievalEvaluationResult.retrievedDocumentIds.length} document(s)`,
      },
      {
        name: RECALL_METRIC_NAME,
        score: retrievalEvaluationResult.recall,
        passed: retrievalEvaluationResult.recall === PERFECT_SCORE,
      },
    ];

    return {
      caseId: evaluationCase.id,
      target: "retrieval",
      passed: retrievalEvaluationResult.passed,
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
