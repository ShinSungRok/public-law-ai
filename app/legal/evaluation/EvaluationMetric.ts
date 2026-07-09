export interface EvaluationMetric {
  name: string;
  score: number;
  passed: boolean;
  details?: string;
}
