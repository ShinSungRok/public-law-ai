import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { RetrievalEvaluationRunner } from "./RetrievalEvaluationRunner";
import { RetrievalEvaluator } from "./RetrievalEvaluator";

const SAMPLE_DOCUMENTS: LegalDocument[] = [
  {
    id: "doc-a",
    documentType: "STATUTE_ARTICLE",
    title: "개인정보보호법",
    text: "개인정보의 처리와 보호에 관한 사항을 정한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "doc-a",
      sourceUrl: "https://fake.local/statutes/a",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: "doc-a" },
  },
  {
    id: "doc-b",
    documentType: "STATUTE_ARTICLE",
    title: "정보통신망법",
    text: "정보통신망 이용을 촉진하고 정보를 보호한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "doc-b",
      sourceUrl: "https://fake.local/statutes/b",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: "doc-b" },
  },
  {
    id: "doc-c",
    documentType: "STATUTE_ARTICLE",
    title: "형법",
    text: "범죄와 형벌에 관한 사항을 규정한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "doc-c",
      sourceUrl: "https://fake.local/statutes/c",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: "doc-c" },
  },
];

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

const EXACT_MATCH_CASE: EvaluationCase = {
  id: "retrieval-exact-match",
  name: "exact document match",
  target: "retrieval",
  query: "개인정보보호법",
  expectedDocumentIds: ["doc-a"],
};

const PARTIAL_MATCH_CASE: EvaluationCase = {
  id: "retrieval-partial-match",
  name: "partial document match",
  target: "retrieval",
  query: "정보 보호",
  expectedDocumentIds: ["doc-a"],
};

const NO_MATCH_CASE: EvaluationCase = {
  id: "retrieval-no-match",
  name: "no document match",
  target: "retrieval",
  query: "환경보전",
  expectedDocumentIds: ["doc-c"],
};

const SAMPLE_CASES: EvaluationCase[] = [
  EXACT_MATCH_CASE,
  PARTIAL_MATCH_CASE,
  NO_MATCH_CASE,
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);

  console.log("[evaluation] Checking RetrievalEvaluator computes precision/recall...");
  const evaluator = new RetrievalEvaluator(retriever);

  const exactResult = await evaluator.evaluate({
    query: EXACT_MATCH_CASE.query,
    expectedDocumentIds: EXACT_MATCH_CASE.expectedDocumentIds!,
  });
  assertEqual(exactResult.precision, 1, "exact match precision mismatch");
  assertEqual(exactResult.recall, 1, "exact match recall mismatch");
  assertTruthy(exactResult.passed, "exact match should pass");

  const partialResult = await evaluator.evaluate({
    query: PARTIAL_MATCH_CASE.query,
    expectedDocumentIds: PARTIAL_MATCH_CASE.expectedDocumentIds!,
  });
  assertTruthy(
    partialResult.retrievedDocumentIds.length > 1,
    "partial match should retrieve more than one document",
  );
  assertEqual(partialResult.precision, 0.5, "partial match precision mismatch");
  assertEqual(partialResult.recall, 1, "partial match recall mismatch");

  const noMatchResult = await evaluator.evaluate({
    query: NO_MATCH_CASE.query,
    expectedDocumentIds: NO_MATCH_CASE.expectedDocumentIds!,
  });
  assertEqual(noMatchResult.precision, 0, "no match precision mismatch");
  assertEqual(noMatchResult.recall, 0, "no match recall mismatch");
  assertTruthy(!noMatchResult.passed, "no match should not pass");

  console.log(
    "[evaluation] Checking RetrievalEvaluationRunner produces EvaluationResult with precision/recall metrics...",
  );
  const runner = new RetrievalEvaluationRunner(retriever);

  const exactRunnerResult = await runner.run(EXACT_MATCH_CASE);
  assertEqual(exactRunnerResult.caseId, EXACT_MATCH_CASE.id, "runner result caseId mismatch");
  assertEqual(exactRunnerResult.target, "retrieval", "runner result target mismatch");
  assertTruthy(exactRunnerResult.passed, "exact match runner result should pass");
  assertEqual(exactRunnerResult.metrics.length, 2, "runner result should carry precision + recall metrics");
  const exactPrecisionMetric = exactRunnerResult.metrics.find(
    (metric) => metric.name === "precision",
  );
  const exactRecallMetric = exactRunnerResult.metrics.find(
    (metric) => metric.name === "recall",
  );
  assertTruthy(exactPrecisionMetric, "runner result missing precision metric");
  assertTruthy(exactRecallMetric, "runner result missing recall metric");
  assertEqual(exactPrecisionMetric!.score, 1, "exact match precision metric score mismatch");
  assertTruthy(exactPrecisionMetric!.passed, "exact match precision metric should pass");
  assertEqual(exactRecallMetric!.score, 1, "exact match recall metric score mismatch");

  const partialRunnerResult = await runner.run(PARTIAL_MATCH_CASE);
  const partialPrecisionMetric = partialRunnerResult.metrics.find(
    (metric) => metric.name === "precision",
  );
  assertEqual(partialPrecisionMetric!.score, 0.5, "partial match precision metric score mismatch");
  assertTruthy(
    !partialPrecisionMetric!.passed,
    "partial match precision metric should not pass (imperfect precision)",
  );

  console.log(
    "[evaluation] Checking RetrievalEvaluationRunner aggregates results into an EvaluationSummary...",
  );
  const summary = await runner.runMany(SAMPLE_CASES);
  assertEqual(summary.totalCount, SAMPLE_CASES.length, "summary totalCount mismatch");
  assertEqual(summary.results.length, SAMPLE_CASES.length, "summary results length mismatch");

  const expectedPassedCount = summary.results.filter((result) => result.passed).length;
  const expectedFailedCount = summary.results.filter((result) => !result.passed).length;
  assertEqual(summary.passedCount, expectedPassedCount, "summary passedCount mismatch");
  assertEqual(summary.failedCount, expectedFailedCount, "summary failedCount mismatch");
  assertEqual(
    summary.passedCount + summary.failedCount,
    summary.totalCount,
    "summary passedCount + failedCount must equal totalCount",
  );
  assertEqual(summary.passedCount, 2, "expected exact + partial match cases to pass");
  assertEqual(summary.failedCount, 1, "expected the no-match case to fail");

  console.log("Retrieval evaluation validation succeeded.");
}

main();
