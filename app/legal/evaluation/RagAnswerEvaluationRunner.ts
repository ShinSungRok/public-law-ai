import type { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import type { EvaluationCase } from "./EvaluationCase";
import type { EvaluationMetric } from "./EvaluationMetric";
import type { EvaluationResult } from "./EvaluationResult";
import type { EvaluationRunner } from "./EvaluationRunner";
import type { EvaluationSummary } from "./EvaluationSummary";

const ANSWER_NOT_EMPTY_METRIC = "answer-not-empty";
const CONTAINS_EXPECTED_KEYWORDS_METRIC = "contains-expected-keywords";
const CITATION_PRESENT_METRIC = "citation-present";
const EXPECTED_CITATION_DOCUMENT_PRESENT_METRIC =
  "expected-citation-document-present";
const PERFECT_SCORE = 1;

function evaluateAnswerNotEmpty(answer: string): EvaluationMetric {
  const passed = answer.trim().length > 0;
  return {
    name: ANSWER_NOT_EMPTY_METRIC,
    score: passed ? 1 : 0,
    passed,
  };
}

function evaluateContainsExpectedKeywords(
  answer: string,
  expectedAnswerKeywords: string[] | undefined,
): EvaluationMetric {
  if (!expectedAnswerKeywords || expectedAnswerKeywords.length === 0) {
    return {
      name: CONTAINS_EXPECTED_KEYWORDS_METRIC,
      score: PERFECT_SCORE,
      passed: true,
      details: "no expected answer keywords specified",
    };
  }

  const normalizedAnswer = answer.toLowerCase();
  const foundKeywords = expectedAnswerKeywords.filter((keyword) =>
    normalizedAnswer.includes(keyword.toLowerCase()),
  );
  const score = foundKeywords.length / expectedAnswerKeywords.length;

  return {
    name: CONTAINS_EXPECTED_KEYWORDS_METRIC,
    score,
    passed: score === PERFECT_SCORE,
    details: `found ${foundKeywords.length}/${expectedAnswerKeywords.length} expected keyword(s)`,
  };
}

function evaluateCitationPresent(citationCount: number): EvaluationMetric {
  const passed = citationCount > 0;
  return {
    name: CITATION_PRESENT_METRIC,
    score: passed ? 1 : 0,
    passed,
  };
}

function evaluateExpectedCitationDocumentPresent(
  citationSourceIds: string[],
  expectedCitationDocumentIds: string[] | undefined,
): EvaluationMetric {
  if (!expectedCitationDocumentIds || expectedCitationDocumentIds.length === 0) {
    return {
      name: EXPECTED_CITATION_DOCUMENT_PRESENT_METRIC,
      score: PERFECT_SCORE,
      passed: true,
      details: "no expected citation document ids specified",
    };
  }

  const citationSourceIdSet = new Set(citationSourceIds);
  const foundDocumentIds = expectedCitationDocumentIds.filter((documentId) =>
    citationSourceIdSet.has(documentId),
  );
  const score = foundDocumentIds.length / expectedCitationDocumentIds.length;

  return {
    name: EXPECTED_CITATION_DOCUMENT_PRESENT_METRIC,
    score,
    passed: score === PERFECT_SCORE,
    details: `found ${foundDocumentIds.length}/${expectedCitationDocumentIds.length} expected citation document(s)`,
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

export class RagAnswerEvaluationRunner implements EvaluationRunner {
  constructor(
    private readonly generateRagAnswerUseCase: GenerateRagAnswerUseCase,
  ) {}

  async run(evaluationCase: EvaluationCase): Promise<EvaluationResult> {
    const ragAnswer = await this.generateRagAnswerUseCase.execute(
      evaluationCase.query,
    );
    const citationSourceIds = ragAnswer.citations.map(
      (citation) => citation.sourceId,
    );

    const metrics: EvaluationMetric[] = [
      evaluateAnswerNotEmpty(ragAnswer.answer),
      evaluateContainsExpectedKeywords(
        ragAnswer.answer,
        evaluationCase.expectedAnswerKeywords,
      ),
      evaluateCitationPresent(ragAnswer.citations.length),
      evaluateExpectedCitationDocumentPresent(
        citationSourceIds,
        evaluationCase.expectedCitationDocumentIds,
      ),
    ];

    return {
      caseId: evaluationCase.id,
      target: "rag-answer",
      passed: metrics.every((metric) => metric.passed),
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
