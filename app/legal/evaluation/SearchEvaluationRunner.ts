import type { SearchEngine } from "../search/SearchEngine";
import type { SearchQuery } from "../search/SearchQuery";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";
import { computePrecision, computeRecall } from "./PrecisionRecallCalculator";

const PRECISION_METRIC_NAME = "precision";
const RECALL_METRIC_NAME = "recall";
const PERFECT_SCORE = 1;

function toSearchQuery(evaluationCase: EvaluationCase): SearchQuery {
  return { text: evaluationCase.query };
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

export class SearchEvaluationRunner implements EvaluationRunner {
  constructor(private readonly searchEngine: SearchEngine) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const expectedDocumentIds = evaluationCase.expectedDocumentIds ?? [];
    const searchHits = await this.searchEngine.search(
      toSearchQuery(evaluationCase),
    );
    const retrievedDocumentIds = searchHits.map((hit) => hit.document.id);

    const precision = computePrecision(expectedDocumentIds, retrievedDocumentIds);
    const recall = computeRecall(expectedDocumentIds, retrievedDocumentIds);

    const metrics: EvaluationMetric[] = [
      {
        name: PRECISION_METRIC_NAME,
        score: precision,
        passed: precision === PERFECT_SCORE,
        details: `retrieved ${retrievedDocumentIds.length} document(s)`,
      },
      {
        name: RECALL_METRIC_NAME,
        score: recall,
        passed: recall === PERFECT_SCORE,
      },
    ];

    return {
      caseId: evaluationCase.id,
      target: "search",
      passed: recall === PERFECT_SCORE,
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
