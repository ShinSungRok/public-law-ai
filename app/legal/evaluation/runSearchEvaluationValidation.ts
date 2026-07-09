import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import { KeywordSearchEngine } from "../search/KeywordSearchEngine";
import type { EvaluationCase } from "./EvaluationCase";
import { SearchEvaluationRunner } from "./SearchEvaluationRunner";

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
  id: "search-exact-match",
  name: "exact document match",
  target: "search",
  query: "개인정보보호법",
  expectedDocumentIds: ["doc-a"],
};

const PARTIAL_MATCH_CASE: EvaluationCase = {
  id: "search-partial-match",
  name: "partial document match",
  target: "search",
  query: "정보 보호",
  expectedDocumentIds: ["doc-a"],
};

const NO_MATCH_CASE: EvaluationCase = {
  id: "search-no-match",
  name: "no document match",
  target: "search",
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
  const searchEngine = new KeywordSearchEngine(retriever);
  const runner = new SearchEvaluationRunner(searchEngine);

  console.log("[evaluation] Checking exact match case...");
  const exactResult = await runner.run(EXACT_MATCH_CASE);
  assertEqual(exactResult.caseId, EXACT_MATCH_CASE.id, "exact match result caseId mismatch");
  assertEqual(exactResult.target, "search", "exact match result target mismatch");
  assertTruthy(exactResult.passed, "exact match should pass");
  const exactPrecision = exactResult.metrics.find((metric) => metric.name === "precision");
  const exactRecall = exactResult.metrics.find((metric) => metric.name === "recall");
  assertTruthy(exactPrecision, "exact match result missing precision metric");
  assertTruthy(exactRecall, "exact match result missing recall metric");
  assertEqual(exactPrecision!.score, 1, "exact match precision mismatch");
  assertTruthy(exactPrecision!.passed, "exact match precision metric should pass");
  assertEqual(exactRecall!.score, 1, "exact match recall mismatch");
  assertTruthy(exactRecall!.passed, "exact match recall metric should pass");

  console.log("[evaluation] Checking partial match case...");
  const partialResult = await runner.run(PARTIAL_MATCH_CASE);
  const partialPrecision = partialResult.metrics.find((metric) => metric.name === "precision");
  const partialRecall = partialResult.metrics.find((metric) => metric.name === "recall");
  assertEqual(partialPrecision!.score, 0.5, "partial match precision mismatch");
  assertTruthy(!partialPrecision!.passed, "partial match precision metric should not pass");
  assertEqual(partialRecall!.score, 1, "partial match recall mismatch");
  assertTruthy(partialResult.passed, "partial match should pass on recall alone");

  console.log("[evaluation] Checking no match case...");
  const noMatchResult = await runner.run(NO_MATCH_CASE);
  const noMatchPrecision = noMatchResult.metrics.find((metric) => metric.name === "precision");
  const noMatchRecall = noMatchResult.metrics.find((metric) => metric.name === "recall");
  assertEqual(noMatchPrecision!.score, 0, "no match precision mismatch");
  assertEqual(noMatchRecall!.score, 0, "no match recall mismatch");
  assertTruthy(!noMatchResult.passed, "no match should not pass");

  console.log("[evaluation] Checking SearchEvaluationRunner aggregates an EvaluationSummary...");
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

  console.log("Search evaluation validation succeeded.");
}

main();
