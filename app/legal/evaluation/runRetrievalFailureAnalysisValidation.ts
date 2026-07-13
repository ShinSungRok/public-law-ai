import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS, toFixtureDocument } from "./RealArticleFixtures";
import { analyzeRetrievalFailures, type RetrievalCaseAnalysis } from "./RetrievalFailureAnalyzer";
import { RETRIEVAL_FAILURE_CATEGORIES } from "./RetrievalFailureCategory";
import {
  buildRetrievalFailureReport,
  formatRetrievalFailureReport,
} from "./RetrievalFailureReport";

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

function assertClose(actual: number, expected: number, message: string): void {
  assertTruthy(
    Math.abs(actual - expected) < 1e-9,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

// -- Layer 1: one hand-crafted, fully controlled scenario per failure -------
// category. Vocabulary is deliberately chosen so each case's query only
// matches the documents relevant to that scenario (verified by hand, not
// just "whatever the retriever happens to do").

const FIXTURE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument("stat-a:1", "가나다 정의", "본문 A"),
  toFixtureDocument("stat-a:2", "가나다 원칙", "본문 A2"),
  toFixtureDocument("filler:1", "공통토큰 채우기1", "내용"),
  toFixtureDocument("filler:2", "공통토큰 채우기2", "내용"),
  toFixtureDocument("filler:3", "공통토큰 채우기3", "내용"),
  toFixtureDocument("filler:4", "공통토큰 채우기4", "내용"),
  toFixtureDocument("filler:5", "공통토큰 채우기5", "내용"),
  toFixtureDocument("stat-e:1", "무관표현", "공통토큰 포함"),
  toFixtureDocument("stat-f:1", "형사절차 총칙", "관련 내용"),
  toFixtureDocument("stat-f:2", "타법령 무관조항", "전혀 관련없음"),
  toFixtureDocument("stat-h:1", "관계없는 문서", "완전 다른 내용"),
  toFixtureDocument("stat-g:1", "찾아야할문서", "특정내용"),
  toFixtureDocument("stat-i:1", "무언가", "내용이다"),
];

// stat-a:1 title has both query tokens -> rank 1.
const SUCCESS_CASE: EvaluationCase = {
  id: "failure-fixture-success",
  name: "clean success",
  target: "retrieval",
  query: "가나다 정의",
  expectedDocumentIds: ["stat-a:1"],
};

// stat-x:99 does not exist in the corpus at all.
const MISSING_CASE: EvaluationCase = {
  id: "failure-fixture-missing",
  name: "expected article missing from corpus",
  target: "retrieval",
  query: "존재하지않는통계",
  expectedDocumentIds: ["stat-x:99"],
};

// Two phrasings of the same underlying question, sharing a variationGroup:
// one matches stat-a:2's title exactly (succeeds), the other shares no
// vocabulary with it at all (fails) -> proves it's a wording problem.
const VARIATION_SUCCESS_CASE: EvaluationCase = {
  id: "failure-fixture-variation-success",
  name: "variation phrasing that succeeds",
  target: "retrieval",
  query: "가나다 원칙",
  expectedDocumentIds: ["stat-a:2"],
  metadata: { category: "query-variation", variationGroup: "vg-shared" },
};
const VARIATION_FAIL_CASE: EvaluationCase = {
  id: "failure-fixture-variation-fail",
  name: "variation phrasing that fails",
  target: "retrieval",
  query: "완전히 다른 표현",
  expectedDocumentIds: ["stat-a:2"],
  metadata: { category: "query-variation", variationGroup: "vg-shared" },
};

// Five filler documents title-match "공통토큰" (score 2 each); stat-e:1 only
// text-matches it (score 1) -> stat-e:1 lands at rank 6, just past top-5.
const OUTSIDE_TOP5_CASE: EvaluationCase = {
  id: "failure-fixture-outside-top5",
  name: "expected article ranked 6th",
  target: "retrieval",
  query: "공통토큰",
  expectedDocumentIds: ["stat-e:1"],
};

// stat-f:2 (expected) shares no vocabulary with the query at all, but its
// same-statute sibling stat-f:1 does -> a sibling article crowds it out.
const SIMILAR_ARTICLE_CASE: EvaluationCase = {
  id: "failure-fixture-similar-article",
  name: "sibling article competition",
  target: "retrieval",
  query: "형사절차",
  expectedDocumentIds: ["stat-f:2"],
};

// stat-g:1 (expected) shares no vocabulary with the query; an unrelated,
// different-statute document (stat-h:1) is retrieved instead.
const WRONG_DOC_CASE: EvaluationCase = {
  id: "failure-fixture-wrong-doc",
  name: "unrelated document ranked higher",
  target: "retrieval",
  query: "관계없는",
  expectedDocumentIds: ["stat-g:1"],
};

// The query matches nothing in the entire corpus -> retrieved = [].
const NOT_RETRIEVED_CASE: EvaluationCase = {
  id: "failure-fixture-not-retrieved",
  name: "nothing retrieved at all",
  target: "retrieval",
  query: "쿼리매치안됨테스트문자열",
  expectedDocumentIds: ["stat-i:1"],
};

// Negative case: not applicable, must be excluded from failure analysis.
const NEGATIVE_CASE: EvaluationCase = {
  id: "failure-fixture-negative",
  name: "out of domain",
  target: "retrieval",
  query: "아무거나",
  expectedDocumentIds: [],
};

const FIXTURE_CASES: EvaluationCase[] = [
  SUCCESS_CASE,
  MISSING_CASE,
  VARIATION_SUCCESS_CASE,
  VARIATION_FAIL_CASE,
  OUTSIDE_TOP5_CASE,
  SIMILAR_ARTICLE_CASE,
  WRONG_DOC_CASE,
  NOT_RETRIEVED_CASE,
  NEGATIVE_CASE,
];

function findAnalysis(analyses: RetrievalCaseAnalysis[], caseId: string): RetrievalCaseAnalysis {
  const analysis = analyses.find((candidate) => candidate.caseId === caseId);
  assertTruthy(analysis, `expected an analysis for case ${caseId}`);
  return analysis!;
}

async function validateEachFailureCategoryIsDetected(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);

  const analyses = await analyzeRetrievalFailures(FIXTURE_CASES, retriever, repository);
  assertEqual(analyses.length, FIXTURE_CASES.length, "expected one analysis per case");

  const success = findAnalysis(analyses, SUCCESS_CASE.id);
  assertTruthy(success.applicable, "success case should be applicable");
  assertTruthy(success.success, "success case should succeed");
  assertEqual(success.rank, 1, "success case should be ranked first");
  assertEqual(success.failureCategory, undefined, "success case should have no failure category");

  const missing = findAnalysis(analyses, MISSING_CASE.id);
  assertTruthy(!missing.success, "missing-corpus case should fail");
  assertEqual(missing.failureCategory, "missing-indexed-content", "expected missing-indexed-content");

  const variationSuccess = findAnalysis(analyses, VARIATION_SUCCESS_CASE.id);
  assertTruthy(variationSuccess.success, "variation-success case should succeed");

  const variationFail = findAnalysis(analyses, VARIATION_FAIL_CASE.id);
  assertTruthy(!variationFail.success, "variation-fail case should fail");
  assertEqual(
    variationFail.failureCategory,
    "query-wording-mismatch",
    "expected query-wording-mismatch (sibling variation succeeded)",
  );

  const outsideTop5 = findAnalysis(analyses, OUTSIDE_TOP5_CASE.id);
  assertTruthy(!outsideTop5.success, "outside-top5 case should fail");
  assertEqual(outsideTop5.rank, 6, "expected the article to be found at rank 6");
  assertEqual(
    outsideTop5.failureCategory,
    "retrieved-outside-top-5",
    "expected retrieved-outside-top-5",
  );

  const similarArticle = findAnalysis(analyses, SIMILAR_ARTICLE_CASE.id);
  assertTruthy(!similarArticle.success, "similar-article case should fail");
  assertEqual(similarArticle.rank, undefined, "expected doc should never appear in retrieved list");
  assertEqual(
    similarArticle.failureCategory,
    "similar-article-competition",
    "expected similar-article-competition",
  );

  const wrongDoc = findAnalysis(analyses, WRONG_DOC_CASE.id);
  assertTruthy(!wrongDoc.success, "wrong-doc case should fail");
  assertEqual(
    wrongDoc.failureCategory,
    "wrong-document-ranked-higher",
    "expected wrong-document-ranked-higher",
  );

  const notRetrieved = findAnalysis(analyses, NOT_RETRIEVED_CASE.id);
  assertTruthy(!notRetrieved.success, "not-retrieved case should fail");
  assertEqual(notRetrieved.retrievedDocumentIds.length, 0, "expected nothing to be retrieved at all");
  assertEqual(
    notRetrieved.failureCategory,
    "expected-document-not-retrieved",
    "expected expected-document-not-retrieved",
  );

  const negative = findAnalysis(analyses, NEGATIVE_CASE.id);
  assertTruthy(!negative.applicable, "negative case should not be applicable");
  assertEqual(negative.failureCategory, undefined, "negative case should have no failure category");
}

async function validateReportAggregation(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const analyses = await analyzeRetrievalFailures(FIXTURE_CASES, retriever, repository);
  const report = buildRetrievalFailureReport(analyses);

  assertEqual(report.datasetSize, FIXTURE_CASES.length, "report datasetSize mismatch");
  assertEqual(report.applicableCaseCount, FIXTURE_CASES.length - 1, "expected the negative case excluded");
  assertEqual(report.successCount, 2, "expected 2 successes (clean success + variation success)");
  assertEqual(report.failureCount, 6, "expected 6 failures (one per named category)");

  const countByCategory = Object.fromEntries(
    report.failureCategoryCounts.map((entry) => [entry.category, entry.count]),
  );
  for (const category of RETRIEVAL_FAILURE_CATEGORIES) {
    if (category === "other") {
      assertEqual(countByCategory[category], 0, "expected the 'other' fallback to be unused by this fixture");
    } else {
      assertEqual(countByCategory[category], 1, `expected exactly one case classified as ${category}`);
    }
  }

  assertEqual(report.topRecurringFailurePatterns.length, 6, "expected 6 non-zero failure patterns");
  assertEqual(report.recommendations.length, 6, "expected one recommendation per observed failure pattern");

  const missedIds = new Set(report.mostFrequentlyMissedArticles.map((entry) => entry.documentId));
  for (const id of ["stat-x:99", "stat-a:2", "stat-e:1", "stat-f:2", "stat-g:1", "stat-i:1"]) {
    assertTruthy(missedIds.has(id), `expected ${id} to be reported as a missed article`);
  }

  // Ranks found: success=1, variation-success=1, outside-top5=6 -> mean 8/3.
  assertClose(
    report.averageRankOfExpectedArticles!,
    8 / 3,
    "average rank of expected articles mismatch",
  );

  const formatted = formatRetrievalFailureReport(report);
  assertTruthy(formatted.includes("Dataset: 9"), "formatted report missing dataset size");
  assertTruthy(formatted.includes("Successful retrievals: 2"), "formatted report missing success count");
  assertTruthy(formatted.includes("Failed retrievals: 6"), "formatted report missing failure count");
  assertTruthy(formatted.includes("query-wording-mismatch"), "formatted report missing a failure category line");
  assertTruthy(formatted.includes("Recommendations"), "formatted report missing recommendations section");
}

// -- Layer 2: full RAG_EVALUATION_DATASET failure analysis against real -----
// article text (REAL_ARTICLE_DOCUMENTS — same corpus as Task 2's retrieval
// metrics validation, reused rather than duplicated).

async function validateFullDatasetAnalysis(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);

  const analyses = await analyzeRetrievalFailures(RAG_EVALUATION_DATASET, retriever, repository);
  assertEqual(analyses.length, RAG_EVALUATION_DATASET.length, "expected one analysis per dataset case");

  const report = buildRetrievalFailureReport(analyses);

  const expectedApplicableCount = RAG_EVALUATION_DATASET.filter(
    (evaluationCase) => (evaluationCase.expectedDocumentIds?.length ?? 0) > 0,
  ).length;
  assertEqual(report.applicableCaseCount, expectedApplicableCount, "applicableCaseCount mismatch");
  assertEqual(
    report.successCount + report.failureCount,
    report.applicableCaseCount,
    "success + failure counts must reconcile with applicableCaseCount",
  );

  const totalCategoryCount = report.failureCategoryCounts.reduce((sum, entry) => sum + entry.count, 0);
  assertEqual(totalCategoryCount, report.failureCount, "failure category counts must sum to failureCount");

  // None of RAG_EVALUATION_DATASET's expected ids are missing from
  // REAL_ARTICLE_DOCUMENTS (Task 2 fetched exactly those ids), so this
  // corpus/dataset combination must never report missing-indexed-content.
  const missingContentCount =
    report.failureCategoryCounts.find((entry) => entry.category === "missing-indexed-content")
      ?.count ?? 0;
  assertEqual(missingContentCount, 0, "expected no missing-indexed-content failures against this corpus");

  console.log("[evaluation] Retrieval failure analysis (RAG_EVALUATION_DATASET, in-memory KeywordRetriever):");
  console.log(formatRetrievalFailureReport(report));
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: retrieval runs against an in-memory KeywordRetriever, no Anthropic/OpenSearch calls. Analysis only -- the Retriever is never modified.",
  );

  console.log("[evaluation] Checking each named failure category is detected correctly...");
  await validateEachFailureCategoryIsDetected();

  console.log("[evaluation] Checking the aggregate failure report...");
  await validateReportAggregation();

  console.log("[evaluation] Running the full RAG_EVALUATION_DATASET failure analysis against real article text...");
  await validateFullDatasetAnalysis();

  console.log("Retrieval failure analysis validation succeeded.");
}

main();
