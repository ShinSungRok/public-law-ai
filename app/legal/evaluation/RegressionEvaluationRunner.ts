import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";
import type { EvaluationTarget } from "./EvaluationTarget";

export type EvaluationRunnerRegistry = Partial<
  Record<EvaluationTarget, EvaluationRunner>
>;

function summarize(results: EvaluationResult[]): EvaluationSummary {
  const passedCount = results.filter((result) => result.passed).length;

  return {
    totalCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
  };
}

export class RegressionEvaluationRunner implements EvaluationRunner {
  constructor(private readonly runnersByTarget: EvaluationRunnerRegistry) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const runner = this.runnersByTarget[evaluationCase.target];
    if (!runner) {
      throw new Error(
        `no evaluation runner registered for target: ${evaluationCase.target}`,
      );
    }

    return runner.run(evaluationCase);
  }

  async runMany(evaluationCases: EvaluationCase[]): Promise<EvaluationSummary> {
    const results: EvaluationResult[] = [];
    for (const evaluationCase of evaluationCases) {
      results.push(await this.run(evaluationCase));
    }

    return summarize(results);
  }
}
