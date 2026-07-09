import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationResult } from "./EvaluationResult";

export interface EvaluationRunner {
  run(evaluationCase: EvaluationCase): Promise<EvaluationResult>;
}
