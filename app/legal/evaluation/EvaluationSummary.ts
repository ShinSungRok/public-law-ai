import type { EvaluationResult } from "./EvaluationResult";

export interface EvaluationSummary {
  totalCount: number;
  passedCount: number;
  failedCount: number;
  results: EvaluationResult[];
}
