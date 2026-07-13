import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import type { EvaluationCase } from "./EvaluationCase";
import type { GroundingMetricsEvaluationRunner } from "./GroundingMetricsEvaluationRunner";
import { analyzeRetrievalFailures } from "./RetrievalFailureAnalyzer";
import type { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import { buildUnifiedEvaluationReport, type UnifiedEvaluationReport } from "./UnifiedEvaluationReport";

/**
 * Orchestrates the three existing, unmodified evaluators —
 * `RetrievalMetricsEvaluationRunner` (Task 2), `analyzeRetrievalFailures`
 * (Task 3), `GroundingMetricsEvaluationRunner` (Task 4) — against the same
 * dataset, then hands their raw output to `buildUnifiedEvaluationReport`.
 * It runs no evaluation logic of its own; each evaluator remains the single
 * place that owns its own metric computation.
 */
export class UnifiedEvaluationRunner {
  constructor(
    private readonly retriever: Retriever,
    private readonly repository: LegalDocumentRepository,
    private readonly retrievalMetricsRunner: RetrievalMetricsEvaluationRunner,
    private readonly groundingMetricsRunner: GroundingMetricsEvaluationRunner,
  ) {}

  async run(cases: EvaluationCase[]): Promise<UnifiedEvaluationReport> {
    const retrievalSummary = await this.retrievalMetricsRunner.runMany(cases);
    const failureAnalyses = await analyzeRetrievalFailures(cases, this.retriever, this.repository);
    const groundingSummary = await this.groundingMetricsRunner.runMany(cases);

    return buildUnifiedEvaluationReport(cases, retrievalSummary, failureAnalyses, groundingSummary);
  }
}
