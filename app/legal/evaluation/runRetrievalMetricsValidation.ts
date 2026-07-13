import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { EvaluationCase } from "./EvaluationCase";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import {
  computeHit,
  computeReciprocalRank,
  computeRecallAtK,
} from "./RetrievalMetricsCalculator";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import {
  buildRetrievalMetricsReport,
  formatRetrievalMetricsReport,
} from "./RetrievalMetricsReport";

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

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

function toFixtureDocument(id: string, title: string, text: string): LegalDocument {
  return {
    id,
    documentType: "STATUTE_ARTICLE",
    title,
    text,
    metadata: {
      sourceSystem: "fake-source",
      sourceId: id,
      sourceUrl: `https://fake.local/statutes/${id}`,
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: { sourceType: "statute_article", sourceId: id },
  };
}

// -- Layer 1: hand-computed precision fixtures ------------------------------
//
// A tiny, fully controlled corpus/query set where the exact KeywordRetriever
// ranking is known in advance (KeywordRetriever: title match = 2pts, text
// match = 1pt per token, stable sort by score desc), so every metric value
// below is hand-computed, not just "whatever the retriever happens to do".

const FIXTURE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument("doc-a", "개인정보 정의", "본문 내용 A"),
  toFixtureDocument("doc-b", "정보 보호", "개인정보 관련 본문"),
  toFixtureDocument("doc-c", "무관 문서", "상관없는 내용"),
];

// doc-a scores 4 (title has both tokens), doc-b scores 1 (text has one
// token) -> retrieved = [doc-a, doc-b]. doc-a is the top hit.
const RANK_1_CASE: EvaluationCase = {
  id: "metrics-fixture-rank-1",
  name: "expected document ranked first",
  target: "retrieval",
  query: "개인정보 정의",
  expectedDocumentIds: ["doc-a"],
};

// doc-b scores 5 (both tokens in title), doc-a scores 2 -> retrieved =
// [doc-b, doc-a]. doc-b is the top hit.
const RANK_1_CASE_B: EvaluationCase = {
  id: "metrics-fixture-rank-1-b",
  name: "a different expected document ranked first",
  target: "retrieval",
  query: "정보 보호",
  expectedDocumentIds: ["doc-b"],
};

// doc-a scores 2 (title has 개인정보), doc-c scores 2 (title has 무관, tied
// with doc-a, stable sort keeps doc-a first since it appears first in the
// corpus array), doc-b scores 1 -> retrieved = [doc-a, doc-c, doc-b].
// doc-c is the expected target, found at rank 2.
const RANK_2_CASE: EvaluationCase = {
  id: "metrics-fixture-rank-2",
  name: "expected document ranked second",
  target: "retrieval",
  query: "개인정보 무관",
  expectedDocumentIds: ["doc-c"],
};

// No document's title/text contains "존재하지않는" -> retrieved = [].
const MISS_CASE: EvaluationCase = {
  id: "metrics-fixture-miss",
  name: "expected document never retrieved",
  target: "retrieval",
  query: "존재하지않는",
  expectedDocumentIds: ["doc-a"],
};

// Negative case: nothing expected, and nothing is retrieved either.
const NEGATIVE_CASE: EvaluationCase = {
  id: "metrics-fixture-negative",
  name: "no expected documents (out of domain)",
  target: "retrieval",
  query: "완전히 다른 도메인",
  expectedDocumentIds: [],
};

const FIXTURE_CASES: EvaluationCase[] = [
  RANK_1_CASE,
  RANK_1_CASE_B,
  RANK_2_CASE,
  MISS_CASE,
  NEGATIVE_CASE,
];

async function validateCalculatorMath(): Promise<void> {
  assertEqual(computeHit(["doc-a"], ["doc-a", "doc-b"]), 1, "hit: expected doc present -> 1");
  assertEqual(computeHit(["doc-c"], ["doc-a", "doc-b"]), 0, "hit: expected doc absent -> 0");
  assertEqual(computeHit([], []), 1, "hit: vacuous (no expected docs) -> 1");

  assertEqual(computeRecallAtK(["doc-c"], ["doc-a", "doc-c", "doc-b"], 1), 0, "recall@1: rank-2 doc not in top 1");
  assertEqual(computeRecallAtK(["doc-c"], ["doc-a", "doc-c", "doc-b"], 3), 1, "recall@3: rank-2 doc is in top 3");
  assertEqual(computeRecallAtK([], ["doc-a"], 1), 1, "recall@k: vacuous (no expected docs) -> 1");

  assertEqual(computeReciprocalRank(["doc-a"], ["doc-a", "doc-b"]), 1, "mrr: found at rank 1 -> 1");
  assertEqual(computeReciprocalRank(["doc-c"], ["doc-a", "doc-c"]), 0.5, "mrr: found at rank 2 -> 0.5");
  assertEqual(computeReciprocalRank(["doc-a"], []), 0, "mrr: never found -> 0");
}

async function validateRetrievalMetricsEvaluationRunner(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const runner = new RetrievalMetricsEvaluationRunner(retriever);

  const rank1Result = await runner.run(RANK_1_CASE);
  assertEqual(rank1Result.target, "retrieval", "runner result target mismatch");
  assertTruthy(rank1Result.passed, "rank-1 case should pass (hit-rate = 1)");
  const rank1Metrics = Object.fromEntries(rank1Result.metrics.map((m) => [m.name, m.score]));
  assertEqual(rank1Metrics["hit-rate"], 1, "rank-1 hit-rate mismatch");
  assertEqual(rank1Metrics["recall@1"], 1, "rank-1 recall@1 mismatch");
  assertEqual(rank1Metrics["recall@3"], 1, "rank-1 recall@3 mismatch");
  assertEqual(rank1Metrics["recall@5"], 1, "rank-1 recall@5 mismatch");
  assertEqual(rank1Metrics["mrr"], 1, "rank-1 mrr mismatch");

  const rank2Result = await runner.run(RANK_2_CASE);
  assertTruthy(rank2Result.passed, "rank-2 case should pass (hit-rate = 1, found further down the list)");
  const rank2Metrics = Object.fromEntries(rank2Result.metrics.map((m) => [m.name, m.score]));
  assertEqual(rank2Metrics["hit-rate"], 1, "rank-2 hit-rate mismatch (found, just not first)");
  assertEqual(rank2Metrics["recall@1"], 0, "rank-2 recall@1 mismatch");
  assertEqual(rank2Metrics["recall@3"], 1, "rank-2 recall@3 mismatch");
  assertEqual(rank2Metrics["mrr"], 0.5, "rank-2 mrr mismatch");

  const missResult = await runner.run(MISS_CASE);
  assertTruthy(!missResult.passed, "miss case should fail (hit-rate = 0)");
  const missMetrics = Object.fromEntries(missResult.metrics.map((m) => [m.name, m.score]));
  assertEqual(missMetrics["hit-rate"], 0, "miss hit-rate mismatch");
  assertEqual(missMetrics["mrr"], 0, "miss mrr mismatch");

  const negativeResult = await runner.run(NEGATIVE_CASE);
  assertTruthy(negativeResult.passed, "negative case should trivially pass (nothing to recall)");

  const summary = await runner.runMany(FIXTURE_CASES);
  assertEqual(summary.totalCount, FIXTURE_CASES.length, "summary totalCount mismatch");
  assertEqual(summary.results.length, FIXTURE_CASES.length, "summary results length mismatch");
}

async function validateAggregateReportMath(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(FIXTURE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const runner = new RetrievalMetricsEvaluationRunner(retriever);

  const results = [];
  for (const evaluationCase of FIXTURE_CASES) {
    results.push(await runner.run(evaluationCase));
  }

  const report = buildRetrievalMetricsReport(FIXTURE_CASES, results);

  assertEqual(report.datasetSize, FIXTURE_CASES.length, "report datasetSize mismatch");
  assertEqual(
    report.positiveCaseCount,
    FIXTURE_CASES.length - 1,
    "expected the negative case to be excluded from positiveCaseCount",
  );

  // Hand-computed over the 4 positive cases: [1,1,1,0], [1,1,1,0], [1,0,1,1], [0,0,0,0].
  assertEqual(report.hitRate, 0.75, "aggregate hit rate mismatch");
  assertEqual(report.recallAt1, 0.5, "aggregate recall@1 mismatch");
  assertEqual(report.recallAt3, 0.75, "aggregate recall@3 mismatch");
  assertEqual(report.recallAt5, 0.75, "aggregate recall@5 mismatch");
  assertEqual(report.mrr, 0.625, "aggregate mrr mismatch");

  const formatted = formatRetrievalMetricsReport(report);
  assertTruthy(formatted.includes(`Dataset: ${FIXTURE_CASES.length}`), "formatted report missing dataset size line");
  assertTruthy(formatted.includes("Hit Rate: 75%"), "formatted report missing hit rate line");
  assertTruthy(formatted.includes("MRR: 0.63"), "formatted report missing mrr line");
}

// -- Layer 2: full RAG_EVALUATION_DATASET report against real article text --
//
// Ids/titles/text below are verbatim excerpts fetched live from the
// production OpenSearch index (public-law-ai-local) for exactly the ids
// RAG_EVALUATION_DATASET's positive cases reference — not fabricated. This
// keeps the validation deterministic/offline while still measuring against
// genuine statute content.
const REAL_ARTICLE_DOCUMENTS: LegalDocument[] = [
  toFixtureDocument(
    "011357:2",
    "개인정보 보호법 제2조(정의)",
    "제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다. 1. \"개인정보\"란 살아 있는 개인에 관한 정보로서 다음 각 목의 어느 하나에 해당하는 정보를 말한다. 1의2. \"가명처리\"란 개인정보의 일부를 삭제하거나 일부 또는 전부를 대체하는 등의 방법으로 추가 정보가 없이는 특정 개인을 알아볼 수 없도록 처리하는 것을 말한다. 3. \"정보주체\"란 처리되는 정보에 의하여 알아볼 수 있는 사람으로서 그 정보의 주체가 되는 사람을 말한다.",
  ),
  toFixtureDocument(
    "011357:3",
    "개인정보 보호법 제3조(개인정보 보호 원칙)",
    "제3조(개인정보 보호 원칙) ① 개인정보처리자는 개인정보의 처리 목적을 명확하게 하여야 하고 그 목적에 필요한 범위에서 최소한의 개인정보만을 적법하고 정당하게 수집하여야 한다.",
  ),
  toFixtureDocument(
    "011357:4",
    "개인정보 보호법 제4조(정보주체의 권리)",
    "제4조(정보주체의 권리) 정보주체는 자신의 개인정보 처리와 관련하여 다음 각 호의 권리를 가진다. 3. 개인정보의 처리 여부를 확인하고 개인정보에 대한 열람 및 전송을 요구할 권리",
  ),
  toFixtureDocument(
    "011357:16",
    "개인정보 보호법 제16조(개인정보의 수집 제한)",
    "제16조(개인정보의 수집 제한) ① 개인정보처리자는 제15조제1항 각 호의 어느 하나에 해당하여 개인정보를 수집하는 경우에는 그 목적에 필요한 최소한의 개인정보를 수집하여야 한다.",
  ),
  toFixtureDocument(
    "011357:17",
    "개인정보 보호법 제17조(개인정보의 제공)",
    "제17조(개인정보의 제공) ① 개인정보처리자는 다음 각 호의 어느 하나에 해당되는 경우에는 정보주체의 개인정보를 제3자에게 제공할 수 있다.",
  ),
  toFixtureDocument(
    "011357:18",
    "개인정보 보호법 제18조(개인정보의 목적 외 이용ㆍ제공 제한)",
    "제18조(개인정보의 목적 외 이용ㆍ제공 제한) ① 개인정보처리자는 개인정보를 제15조제1항에 따른 범위를 초과하여 이용하거나 제3자에게 제공하여서는 아니 된다.",
  ),
  toFixtureDocument(
    "011357:21",
    "개인정보 보호법 제21조(개인정보의 파기)",
    "제21조(개인정보의 파기) ① 개인정보처리자는 보유기간의 경과, 개인정보의 처리 목적 달성 등 그 개인정보가 불필요하게 되었을 때에는 지체 없이 그 개인정보를 파기하여야 한다.",
  ),
  toFixtureDocument(
    "011357:22",
    "개인정보 보호법 제22조(동의를 받는 방법)",
    "제22조(동의를 받는 방법) ① 개인정보처리자는 이 법에 따른 개인정보의 처리에 대하여 정보주체의 동의를 받을 때에는 각각의 동의 사항을 구분하여 알리고 동의를 받아야 한다.",
  ),
  toFixtureDocument(
    "011357:27",
    "개인정보 보호법 제27조(영업양도 등에 따른 개인정보의 이전 제한)",
    "제27조(영업양도 등에 따른 개인정보의 이전 제한) ① 개인정보처리자는 영업의 전부 또는 일부의 양도ㆍ합병 등으로 개인정보를 다른 사람에게 이전하는 경우에는 미리 해당 정보주체에게 알려야 한다.",
  ),
  toFixtureDocument(
    "011357:28-4",
    "개인정보 보호법 제28-4조(가명정보에 대한 안전조치의무 등)",
    "제28조의4(가명정보에 대한 안전조치의무 등) ① 개인정보처리자는 가명정보를 처리하는 경우에는 해당 정보가 분실ㆍ도난ㆍ유출ㆍ위조ㆍ변조 또는 훼손되지 않도록 안전성 확보에 필요한 조치를 하여야 한다.",
  ),
  toFixtureDocument(
    "011357:28-9",
    "개인정보 보호법 제28-9조(개인정보의 국외 이전 중지 명령)",
    "제28조의9(개인정보의 국외 이전 중지 명령) ① 보호위원회는 개인정보의 국외 이전이 계속되고 있거나 추가적인 국외 이전이 예상되는 경우 개인정보처리자에게 개인정보의 국외 이전을 중지할 것을 명할 수 있다.",
  ),
  toFixtureDocument(
    "011357:34",
    "개인정보 보호법 제34조(개인정보 유출 등의 통지ㆍ신고)",
    "제34조(개인정보 유출 등의 통지ㆍ신고) ① 개인정보처리자는 개인정보가 분실ㆍ도난ㆍ유출되었음을 알게 되었을 때에는 지체 없이 해당 정보주체에게 통지하여야 한다.",
  ),
  toFixtureDocument(
    "011357:36",
    "개인정보 보호법 제36조(개인정보의 정정ㆍ삭제)",
    "제36조(개인정보의 정정ㆍ삭제) ① 자신의 개인정보를 열람한 정보주체는 개인정보처리자에게 그 개인정보의 정정 또는 삭제를 요구할 수 있다.",
  ),
  toFixtureDocument(
    "011357:37",
    "개인정보 보호법 제37조(개인정보의 처리정지 등)",
    "제37조(개인정보의 처리정지 등) ① 정보주체는 개인정보처리자에 대하여 자신의 개인정보 처리의 정지를 요구하거나 개인정보 처리에 대한 동의를 철회할 수 있다.",
  ),
  toFixtureDocument(
    "011357:39",
    "개인정보 보호법 제39조(손해배상책임)",
    "제39조(손해배상책임) ① 정보주체는 개인정보처리자가 이 법을 위반한 행위로 손해를 입으면 개인정보처리자에게 손해배상을 청구할 수 있다.",
  ),
  toFixtureDocument(
    "011468:21",
    "개인정보 보호법 시행령 제21조(고유식별정보의 안전성 확보 조치)",
    "제21조(고유식별정보의 안전성 확보 조치) ① 법 제24조제3항에 따른 고유식별정보의 안전성 확보 조치에 관하여는 제30조를 준용한다.",
  ),
];

async function validateFullDatasetReport(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const runner = new RetrievalMetricsEvaluationRunner(retriever);

  const summary = await runner.runMany(RAG_EVALUATION_DATASET);
  assertEqual(summary.totalCount, RAG_EVALUATION_DATASET.length, "expected one result per dataset case");

  const report = buildRetrievalMetricsReport(RAG_EVALUATION_DATASET, summary.results);

  assertEqual(report.datasetSize, RAG_EVALUATION_DATASET.length, "report datasetSize mismatch");
  const expectedPositiveCount = RAG_EVALUATION_DATASET.filter(
    (evaluationCase) => (evaluationCase.expectedDocumentIds?.length ?? 0) > 0,
  ).length;
  assertEqual(
    report.positiveCaseCount,
    expectedPositiveCount,
    "expected negative (out-of-domain) cases to be excluded from positiveCaseCount",
  );

  // Mathematical invariants that must hold regardless of retriever quality:
  // more retrieved candidates (larger K) can only help recall, and MRR can
  // never exceed hit rate (a found-at-rank-N case contributes 1/N <= 1 to
  // MRR but a full 1 to hit rate).
  for (const [name, value] of Object.entries(report)) {
    if (typeof value === "number" && name !== "datasetSize" && name !== "positiveCaseCount") {
      assertTruthy(value >= 0 && value <= 1, `expected ${name} to be within [0, 1], got ${value}`);
    }
  }
  assertTruthy(report.recallAt1 <= report.recallAt3, "expected recall@1 <= recall@3");
  assertTruthy(report.recallAt3 <= report.recallAt5, "expected recall@3 <= recall@5");
  assertTruthy(report.recallAt5 <= report.hitRate, "expected recall@5 <= hit rate (hit rate is unbounded recall)");
  assertTruthy(report.mrr <= report.hitRate, "expected mrr <= hit rate");

  console.log("[evaluation] Retrieval metrics report (RAG_EVALUATION_DATASET, in-memory KeywordRetriever):");
  console.log(formatRetrievalMetricsReport(report));
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: retrieval runs against an in-memory KeywordRetriever, no Anthropic/OpenSearch calls.",
  );

  console.log("[evaluation] Checking RetrievalMetricsCalculator math against hand-computed values...");
  await validateCalculatorMath();

  console.log("[evaluation] Checking RetrievalMetricsEvaluationRunner produces correct per-case metrics...");
  await validateRetrievalMetricsEvaluationRunner();

  console.log("[evaluation] Checking the aggregate report averages correctly and excludes negative cases...");
  await validateAggregateReportMath();

  console.log("[evaluation] Running the full RAG_EVALUATION_DATASET report against real article text...");
  await validateFullDatasetReport();

  console.log("Retrieval metrics validation succeeded.");
}

main();
