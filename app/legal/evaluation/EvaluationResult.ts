import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationTarget } from "./EvaluationTarget";

export interface EvaluationResult {
  caseId: string;
  target: EvaluationTarget;
  passed: boolean;
  metrics: EvaluationMetric[];
  details?: string;
}
