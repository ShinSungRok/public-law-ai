import {
  RETRIEVAL_FAILURE_CATEGORIES,
  type RetrievalFailureCategory,
} from "./RetrievalFailureCategory";
import type { RetrievalCaseAnalysis } from "./RetrievalFailureAnalyzer";

const TOP_FAILED_QUESTIONS_LIMIT = 10;
const MOST_MISSED_ARTICLES_LIMIT = 10;

export interface FailureCategoryCount {
  category: RetrievalFailureCategory;
  count: number;
}

export interface FailedQuestionSummary {
  caseId: string;
  query: string;
  rank: number | undefined;
  failureCategory: RetrievalFailureCategory;
}

export interface MissedArticleCount {
  documentId: string;
  missCount: number;
}

export interface RetrievalFailureReport {
  datasetSize: number;
  /** Cases with at least one expected document — the only cases a success/failure verdict applies to. */
  applicableCaseCount: number;
  successCount: number;
  failureCount: number;
  failureCategoryCounts: FailureCategoryCount[];
  /** Same data as failureCategoryCounts, sorted descending — the dominant failure modes. */
  topRecurringFailurePatterns: FailureCategoryCount[];
  topFailedQuestions: FailedQuestionSummary[];
  mostFrequentlyMissedArticles: MissedArticleCount[];
  /** Average 1-indexed rank across cases where the expected document was found somewhere (undefined if none ever were). */
  averageRankOfExpectedArticles: number | undefined;
  recommendations: string[];
}

const RECOMMENDATION_BY_CATEGORY: Record<RetrievalFailureCategory, string> = {
  "missing-indexed-content":
    "Some expected articles are not present in the index/corpus at all — this is a data/pipeline gap, not a retrieval-quality issue; re-run indexing for the affected statute(s).",
  "query-wording-mismatch":
    "The same target article is retrieved successfully for some phrasings of a question but not others — consider query normalization (stripping particles) or synonym expansion, since the content exists and is findable, just not via every phrasing.",
  "retrieved-outside-top-5":
    "Expected articles are retrieved but ranked below the top 5 — consider whether the RAG context window should be widened, or ranking signals strengthened.",
  "similar-article-competition":
    "Adjacent articles from the same statute are crowding out the correct one — consider a matching strategy that favors exact article-number/title matches over neighboring articles in the same statute.",
  "wrong-document-ranked-higher":
    "Unrelated documents are consistently outranking the correct article — consider stronger title/exact-term weighting.",
  "expected-document-not-retrieved":
    "Some expected articles never appear in retrieval results at all, with no more specific explanation found — consider broader vocabulary coverage between the query and article text.",
  other: "Some failures do not fit a specific detected pattern — manual review recommended.",
};

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildRetrievalFailureReport(
  analyses: RetrievalCaseAnalysis[],
): RetrievalFailureReport {
  const applicable = analyses.filter((analysis) => analysis.applicable);
  const successes = applicable.filter((analysis) => analysis.success);
  const failures = applicable.filter((analysis) => !analysis.success);

  const failureCategoryCounts: FailureCategoryCount[] = RETRIEVAL_FAILURE_CATEGORIES.map(
    (category) => ({
      category,
      count: failures.filter((failure) => failure.failureCategory === category).length,
    }),
  );

  const topRecurringFailurePatterns = failureCategoryCounts
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  const topFailedQuestions: FailedQuestionSummary[] = [...failures]
    // Worst first: never-found (rank undefined) ranks worse than found-but-late.
    .sort((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY))
    .slice(0, TOP_FAILED_QUESTIONS_LIMIT)
    .map((failure) => ({
      caseId: failure.caseId,
      query: failure.query,
      rank: failure.rank,
      failureCategory: failure.failureCategory!,
    }));

  const missCountByDocumentId = new Map<string, number>();
  for (const failure of failures) {
    for (const documentId of failure.expectedDocumentIds) {
      missCountByDocumentId.set(documentId, (missCountByDocumentId.get(documentId) ?? 0) + 1);
    }
  }
  const mostFrequentlyMissedArticles: MissedArticleCount[] = Array.from(
    missCountByDocumentId.entries(),
  )
    .map(([documentId, missCount]) => ({ documentId, missCount }))
    .sort((a, b) => b.missCount - a.missCount)
    .slice(0, MOST_MISSED_ARTICLES_LIMIT);

  const foundRanks = applicable
    .map((analysis) => analysis.rank)
    .filter((rank): rank is number => rank !== undefined);

  const recommendations = topRecurringFailurePatterns.map(
    (entry) => RECOMMENDATION_BY_CATEGORY[entry.category],
  );

  return {
    datasetSize: analyses.length,
    applicableCaseCount: applicable.length,
    successCount: successes.length,
    failureCount: failures.length,
    failureCategoryCounts,
    topRecurringFailurePatterns,
    topFailedQuestions,
    mostFrequentlyMissedArticles,
    averageRankOfExpectedArticles: average(foundRanks),
    recommendations,
  };
}

function formatRank(rank: number | undefined): string {
  return rank === undefined ? "not found" : `rank ${rank}`;
}

export function formatRetrievalFailureReport(report: RetrievalFailureReport): string {
  const lines: string[] = [
    "== Dataset Summary ==",
    `Dataset: ${report.datasetSize}`,
    `Applicable cases: ${report.applicableCaseCount}`,
    `Successful retrievals: ${report.successCount}`,
    `Failed retrievals: ${report.failureCount}`,
    "",
    "== Failure Category Counts ==",
    ...report.failureCategoryCounts.map((entry) => `${entry.category}: ${entry.count}`),
    "",
    "== Top Recurring Failure Patterns ==",
    ...(report.topRecurringFailurePatterns.length > 0
      ? report.topRecurringFailurePatterns.map((entry) => `${entry.category}: ${entry.count} case(s)`)
      : ["(none)"]),
    "",
    "== Top Failed Questions ==",
    ...(report.topFailedQuestions.length > 0
      ? report.topFailedQuestions.map(
          (entry) => `[${entry.failureCategory}] ${entry.query} (${formatRank(entry.rank)}, case: ${entry.caseId})`,
        )
      : ["(none)"]),
    "",
    "== Most Frequently Missed Articles ==",
    ...(report.mostFrequentlyMissedArticles.length > 0
      ? report.mostFrequentlyMissedArticles.map(
          (entry) => `${entry.documentId}: missed ${entry.missCount} time(s)`,
        )
      : ["(none)"]),
    "",
    `Average rank of expected articles (when found): ${
      report.averageRankOfExpectedArticles === undefined
        ? "n/a"
        : report.averageRankOfExpectedArticles.toFixed(2)
    }`,
    "",
    "== Recommendations (analysis only) ==",
    ...(report.recommendations.length > 0 ? report.recommendations : ["(none)"]),
  ];

  return lines.join("\n");
}
