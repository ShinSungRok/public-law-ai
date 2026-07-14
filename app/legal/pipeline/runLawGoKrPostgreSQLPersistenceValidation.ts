import { readFileSync } from "node:fs";
import path from "node:path";
import type { HttpClient } from "./http";
import {
  runLawGoKrPostgreSQLPersistence,
  type LawGoKrPostgreSQLPersistenceSummary,
} from "./runLawGoKrStatuteSearchWithPostgreSQLPersistence";
import { runPostgreSQLLegalDocumentReindex } from "./runPostgreSQLLegalDocumentReindex";
import type { RawLegalData } from "./RawLegalData";
import { LawGoKrStatuteDetailParser } from "./source/LawGoKrStatuteDetailParser";
import { FakeLegalDocumentRepository } from "../persistence/FakeLegalDocumentRepository";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchLegalDocument } from "../search/opensearch/OpenSearchLegalDocument";

const FAKE_OC = "fake-oc-for-validation-only";

// -- Fixtures --------------------------------------------------------------
//
// SEARCH_RESPONSE returns the real 개인정보 보호법 statute id (011357), a
// duplicate/historical-version repeat of it (must be detail-fetched only
// once), and a second real statute id (011468, 개인정보 보호법 시행령).
const SEARCH_RESPONSE = JSON.stringify({
  LawSearch: {
    law: [
      { 법령ID: "011357", 법령명한글: "개인정보 보호법", 법령구분명: "법률" },
      { 법령ID: "011468", 법령명한글: "개인정보 보호법 시행령", 법령구분명: "대통령령" },
      { 법령ID: "011357", 법령명한글: "개인정보 보호법", 법령구분명: "법률" },
    ],
  },
});

// 011357 detail: article 28-9 (real content), a chapter-heading
// pseudo-entry that collides on 조문번호="29" with the real 제29조, the real
// 제29조(안전조치의무), 제30조(개인정보 처리방침의 수립·공개), and a blank
// article that must be skipped -- reproducing the exact
// production collision documented in
// runLawGoKrOpenSearchIndexingValidation.ts, extended with article 30 so
// this validation directly exercises the task's own "011357:29" /
// "011357:30" examples.
const STATUTE_011357_DETAIL_RESPONSE = JSON.stringify({
  법령: {
    기본정보: {
      법령명_한글: "개인정보 보호법",
      공포일자: "20250401",
      시행일자: "20251002",
    },
    조문: {
      조문단위: [
        {
          조문번호: "28",
          조문가지번호: "9",
          조문제목: "개인정보의 국외 이전 중지 명령",
          조문내용:
            "제28조의9(개인정보의 국외 이전 중지 명령) 보호위원회는 국외 이전이 개인정보를 부당하게 낮은 수준으로 보호할 우려가 있다고 인정하는 경우 그 중지를 명할 수 있다.",
        },
        {
          // Chapter-heading pseudo-entry: no 조문제목, no 항, and its
          // 조문내용 is purely a "제N장 ..." heading line -- collides on
          // 조문번호="29" with the real article below.
          조문번호: "29",
          조문가지번호: "0",
          조문내용: "제4장 개인정보의 안전한 관리",
        },
        {
          조문번호: "29",
          조문가지번호: "0",
          조문제목: "안전조치의무",
          조문내용:
            "제29조(안전조치의무) 개인정보처리자는 개인정보가 분실ㆍ도난ㆍ유출ㆍ위조ㆍ변조 또는 훼손되지 아니하도록 내부 관리계획 수립, 접속기록 보관 등 대통령령으로 정하는 바에 따라 안전성 확보에 필요한 기술적ㆍ관리적 및 물리적 조치를 하여야 한다.",
        },
        {
          조문번호: "30",
          조문가지번호: "0",
          조문제목: "개인정보 처리방침의 수립 및 공개",
          조문내용:
            "제30조(개인정보 처리방침의 수립 및 공개) 개인정보처리자는 개인정보의 처리 목적, 처리 및 보유 기간 등이 포함된 개인정보 처리방침을 정하여야 한다.",
        },
        {
          조문번호: "31",
          조문가지번호: "0",
          조문제목: "",
          조문내용: "",
        },
      ],
    },
  },
});

// 011468 detail: a single usable article on a second, distinct statute.
const STATUTE_011468_DETAIL_RESPONSE = JSON.stringify({
  법령: {
    기본정보: {
      법령명_한글: "개인정보 보호법 시행령",
      공포일자: "20250401",
      시행일자: "20251002",
    },
    조문: {
      조문단위: [
        {
          조문번호: "1",
          조문가지번호: "0",
          조문제목: "목적",
          조문내용: "제1조(목적) 이 영은 「개인정보 보호법」에서 위임된 사항과 그 시행에 필요한 사항을 규정함을 목적으로 한다.",
        },
      ],
    },
  },
});

class RoutedFakeLawGoKrHttpClient implements HttpClient {
  readonly detailCallCountById = new Map<string, number>();

  constructor(
    private readonly searchResponse: string,
    private readonly detailResponses: Record<string, string>,
    private readonly failingDetailIds: Set<string> = new Set(),
  ) {}

  async get(url: string): Promise<string> {
    const parsed = new URL(url);

    if (parsed.pathname.endsWith("lawSearch.do")) {
      return this.searchResponse;
    }

    if (parsed.pathname.endsWith("lawService.do")) {
      const id = parsed.searchParams.get("ID") ?? "";
      this.detailCallCountById.set(id, (this.detailCallCountById.get(id) ?? 0) + 1);

      if (this.failingDetailIds.has(id)) {
        throw new Error(`simulated network failure fetching detail for ${id}`);
      }

      const response = this.detailResponses[id];
      if (response === undefined) {
        throw new Error(`no fixture registered for law.go.kr detail id "${id}"`);
      }
      return response;
    }

    throw new Error(`unexpected law.go.kr URL requested in validation: ${url}`);
  }
}

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

function withLawGoKrEnv<T>(fn: () => Promise<T>): Promise<T> {
  process.env.LAW_GO_KR_OC = FAKE_OC;
  return fn().finally(() => {
    delete process.env.LAW_GO_KR_OC;
  });
}

function readRunnerSource(): string {
  return readFileSync(
    path.resolve(
      process.cwd(),
      "app/legal/pipeline/runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts",
    ),
    "utf8",
  );
}

/** Mirrors runLawGoKrOpenSearchIndexingValidation.ts's assertExistingPipelineReuse: proves this is not a parallel pipeline. */
function assertExistingPipelineReuse(): void {
  const source = readRunnerSource();

  const requiredReferences = [
    "LawGoKrStatuteSearchDownloader",
    "LawGoKrStatuteSearchParser",
    "LawGoKrStatuteDetailDownloader",
    "LawGoKrStatuteDetailParser",
    "PublicLegalDataPipeline",
    "ImportStatutesUseCase",
    "PostgreSQLLegalDocumentRepository",
    "createLawGoKrConfigFromEnv",
    "assertLawGoKrConfig",
    "createPostgreSQLConfigFromEnv",
    "assertPostgreSQLConfig",
  ];
  for (const reference of requiredReferences) {
    assertTruthy(
      source.includes(reference),
      `runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts does not reuse the existing ${reference}`,
    );
  }

  assertTruthy(
    !/class\s+\w+\s+implements\s+(PublicLegalDataDownloader|PublicLegalDataParser|LegalDocumentRepository)\b/.test(
      source,
    ),
    "runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts must not define a duplicate downloader/parser/repository implementation",
  );

  assertTruthy(
    !/https?:\/\/(?!.*\[REDACTED\]).*law\.go\.kr/i.test(source),
    "runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts must not hard-code a real external endpoint",
  );
}

function readReindexRunnerSource(): string {
  return readFileSync(
    path.resolve(process.cwd(), "app/legal/pipeline/runPostgreSQLLegalDocumentReindex.ts"),
    "utf8",
  );
}

/**
 * Proves the reindex CLI (pnpm db:legal:reindex) composes real dependencies
 * — createOpenSearchConfigFromEnv/OpenSearchSdkClient, reused unmodified —
 * rather than falling through to runPostgreSQLLegalDocumentReindex's own
 * FakeOpenSearchClient default, which must still exist (and does — see
 * validatePostgreSQLReindexProducesArticleLevelOpenSearchDocuments below,
 * which exercises that exact default/injection path) for validations to
 * keep working. A source-text check, not a live run: main() intentionally
 * makes a real network/OpenSearch call, so it is exercised for real
 * separately (pnpm db:legal:reindex against real infra), not from this
 * dependency-free validation suite.
 */
function assertReindexCliUsesRealOpenSearchComposition(): void {
  const source = readReindexRunnerSource();

  for (const reference of ["createOpenSearchConfigFromEnv", "OpenSearchSdkClient"]) {
    assertTruthy(
      source.includes(reference),
      `runPostgreSQLLegalDocumentReindex.ts does not reuse the existing ${reference}`,
    );
  }

  const mainMatch = source.match(/async function main\(\): Promise<void> \{([\s\S]*?)\n\}\n\nif \(require\.main/);
  assertTruthy(mainMatch, "runPostgreSQLLegalDocumentReindex.ts must define a main() entrypoint guarded by require.main");
  const mainBody = mainMatch![1];

  assertTruthy(
    mainBody.includes("new OpenSearchSdkClient("),
    "expected main() to construct the real OpenSearchSdkClient rather than relying on any default",
  );
  assertTruthy(
    mainBody.includes("createOpenSearchConfigFromEnv()"),
    "expected main() to read the real, environment-configured OpenSearchConfig",
  );
  assertTruthy(
    !/runPostgreSQLLegalDocumentReindex\(\)/.test(mainBody),
    "expected main() to pass explicit real dependencies (openSearchClient, openSearchConfig), not call runPostgreSQLLegalDocumentReindex() with its fake-defaulting no-args form",
  );
  assertTruthy(
    !mainBody.includes("FakeOpenSearchClient"),
    "expected main() to never reference FakeOpenSearchClient — the fake default must only be reachable via runPostgreSQLLegalDocumentReindex()'s own no-args default, used by validations/tests",
  );

  console.log("[pipeline] Reindex CLI composition validated: main() always wires the real OpenSearchSdkClient/createOpenSearchConfigFromEnv, never the fake default.");
}

async function validateFullPersistenceEndToEnd(): Promise<{
  repository: FakeLegalDocumentRepository;
  summary: LawGoKrPostgreSQLPersistenceSummary;
}> {
  return withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(SEARCH_RESPONSE, {
      "011357": STATUTE_011357_DETAIL_RESPONSE,
      "011468": STATUTE_011468_DETAIL_RESPONSE,
    });
    const repository = new FakeLegalDocumentRepository();

    const summary = await runLawGoKrPostgreSQLPersistence({
      httpClient,
      repository,
      query: "개인정보",
    });

    // Search-to-detail flow: duplicate search identifiers fetched once.
    assertEqual(summary.statuteCount, 2, "expected two distinct statutes after dedupe");
    assertEqual(
      httpClient.detailCallCountById.get("011357"),
      1,
      "expected the duplicate 011357 search hit to trigger exactly one detail request",
    );

    // Multiple articles persisted per statute: 011357 -> 3 usable articles
    // (28-9, 29, 30 -- chapter heading and blank article-31 both skipped).
    assertEqual(
      summary.parsedArticleCount,
      4,
      "expected 4 article-level documents across both statutes (3 from 011357, 1 from 011468)",
    );
    assertEqual(summary.persistedArticleCount, 4, "expected all 4 article documents to be persisted");
    assertEqual(summary.failedStatuteIds.length, 0, "expected no failed statutes");
    assertEqual(summary.detailEmptyStatuteIds.length, 0, "expected no empty-detail statutes");

    const allEntities = await repository.findAll();
    assertEqual(allEntities.length, 4, "expected exactly 4 rows persisted to the repository");

    // Article ids preserved exactly as the task specifies.
    const article29 = await repository.findByDocumentId("011357:29");
    const article30 = await repository.findByDocumentId("011357:30");
    assertTruthy(article29, "expected 011357:29 to be persisted");
    assertTruthy(article30, "expected 011357:30 to be persisted");
    assertEqual(article29!.documentId, "011357:29", "expected article id preserved exactly as 011357:29");
    assertEqual(article30!.documentId, "011357:30", "expected article id preserved exactly as 011357:30");

    // sourceType stored as statute_article, on the raw LegalDocument that
    // was actually persisted (not reimplemented/duplicated here).
    const article29Document = JSON.parse(article29!.rawData) as {
      sourceRef: { sourceType: string; sourceId: string };
      documentType: string;
    };
    assertEqual(article29Document.sourceRef.sourceType, "statute_article", "expected sourceRef.sourceType stored as statute_article");
    assertEqual(article29Document.documentType, "STATUTE_ARTICLE", "expected documentType preserved as STATUTE_ARTICLE");

    // Chapter heading did not overwrite the real article.
    assertTruthy(
      article29Document !== null &&
        JSON.stringify(article29Document).includes("안전성 확보에 필요한 기술적ㆍ관리적 및 물리적 조치"),
      "expected 011357:29 to carry the real article body text",
    );
    assertTruthy(
      !JSON.stringify(article29Document).includes("제4장 개인정보의 안전한 관리"),
      "expected 011357:29 not to be shadowed by the chapter-heading text",
    );

    // Blank article-31 and the heading pseudo-entry never became rows.
    assertTruthy(!(await repository.existsByDocumentId("011357:31")), "expected the blank article to be skipped, not persisted");

    const otherStatuteArticle = await repository.findByDocumentId("011468:1");
    assertTruthy(otherStatuteArticle, "expected the second statute's article to be persisted");

    console.log(
      "[pipeline] Full persistence validated: multiple articles per statute, exact article ids, sourceType, and chapter-heading protection.",
    );

    return { repository, summary };
  });
}

async function validateRepeatedImportDoesNotDuplicate(
  repository: FakeLegalDocumentRepository,
): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(SEARCH_RESPONSE, {
      "011357": STATUTE_011357_DETAIL_RESPONSE,
      "011468": STATUTE_011468_DETAIL_RESPONSE,
    });

    const beforeCount = (await repository.findAll()).length;

    const secondSummary = await runLawGoKrPostgreSQLPersistence({
      httpClient,
      repository,
      query: "개인정보",
    });

    const afterCount = (await repository.findAll()).length;

    assertEqual(afterCount, beforeCount, "expected a repeated import to introduce no new rows");
    assertEqual(
      secondSummary.persistedArticleCount,
      4,
      "expected a repeated run to report the same persisted article count",
    );

    const documentIds = (await repository.findAll()).map((entity) => entity.documentId);
    assertEqual(
      new Set(documentIds).size,
      documentIds.length,
      "expected no duplicate document ids after a repeated import",
    );

    console.log("[pipeline] Repeated import validated: upsert-by-document-id introduces no duplicates.");
  });
}

async function validatePartialDetailFailureDoesNotDiscardSuccessfulStatutes(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(
      SEARCH_RESPONSE,
      { "011357": STATUTE_011357_DETAIL_RESPONSE, "011468": STATUTE_011468_DETAIL_RESPONSE },
      new Set(["011468"]),
    );
    const repository = new FakeLegalDocumentRepository();

    const summary = await runLawGoKrPostgreSQLPersistence({
      httpClient,
      repository,
      query: "개인정보",
    });

    assertEqual(summary.statuteCount, 2, "expected both statutes to be found by search");
    assertTruthy(
      summary.failedStatuteIds.includes("011468"),
      "expected the failed detail fetch for 011468 to be reported",
    );
    assertEqual(
      summary.persistedArticleCount,
      3,
      "expected 011357's 3 usable articles to still be persisted after 011468's detail fetch failed",
    );

    const article29 = await repository.findByDocumentId("011357:29");
    assertTruthy(article29, "expected the successful statute's articles to be persisted despite the other statute's failure");

    console.log("[pipeline] Partial detail-fetch failure validated: successful statutes are not discarded.");
  });
}

async function validateDetailParserChapterHeadingProtectionUnmodified(): Promise<void> {
  const parser = new LawGoKrStatuteDetailParser();
  const rawData: RawLegalData = {
    id: "law.go.kr:statute-detail:011357",
    sourceSystem: "law.go.kr",
    sourceId: "011357",
    rawFormat: "json",
    content: STATUTE_011357_DETAIL_RESPONSE,
    collectedAt: "2026-07-14T00:00:00Z",
  };

  const parsed = await parser.parse(rawData);
  assertEqual(parsed.length, 3, "expected 3 usable articles from the shared detail parser (heading + blank article skipped)");
  const ids = parsed.map((p) => p.document.id);
  assertTruthy(ids.includes("011357:29") && ids.includes("011357:30"), "expected the reused, unmodified detail parser to produce 011357:29 and 011357:30");
}

async function validatePostgreSQLReindexProducesArticleLevelOpenSearchDocuments(
  repository: FakeLegalDocumentRepository,
): Promise<void> {
  const openSearchClient = new FakeOpenSearchClient();

  const reindexSummary = await runPostgreSQLLegalDocumentReindex({
    repository,
    openSearchClient,
    openSearchConfig: { node: "fake://local-opensearch", indexName: "legal-documents-reindex-validation" },
    query: "안전조치의무",
  });

  assertEqual(reindexSummary.loadedCount, 4, "expected all 4 persisted rows to be loaded from PostgreSQL for reindexing");
  assertEqual(reindexSummary.totalCount, 4, "expected all 4 loaded documents to be attempted for indexing");
  assertEqual(reindexSummary.indexedCount, 4, "expected all 4 documents to be indexed into OpenSearch");
  assertEqual(reindexSummary.failedCount, 0, "expected no reindexing failures");
  assertTruthy(reindexSummary.searchResultCount > 0, "expected 제29조(안전조치의무) to be found by the post-reindex search");

  const searchResults = (await openSearchClient.search("legal-documents-reindex-validation", {
    query: { multi_match: { query: "안전조치의무" } },
    size: 10,
  })) as { hits: { hits: { _id: string; _source: OpenSearchLegalDocument }[] } };
  const indexedById = new Map(searchResults.hits.hits.map((hit) => [hit._id, hit._source]));

  const reindexedArticle29 = indexedById.get("011357:29");
  assertTruthy(reindexedArticle29, "expected 개인정보 보호법 제29조 (011357:29) to be recoverable from PostgreSQL and reindexable to OpenSearch");
  assertEqual(reindexedArticle29!.documentType, "STATUTE_ARTICLE", "expected the reindexed document to be article-level (STATUTE_ARTICLE), not a raw statute-level record");
  assertTruthy(
    reindexedArticle29!.text.includes("안전성 확보에 필요한 기술적ㆍ관리적 및 물리적 조치"),
    "expected the reindexed article to carry the real article body text recovered from PostgreSQL",
  );

  console.log(
    "[pipeline] PostgreSQL -> OpenSearch reindex validated: article-level documents rebuilt, 개인정보 보호법 제29조 recoverable and searchable.",
  );
}

async function main(): Promise<void> {
  console.log(
    "[pipeline] No external services required: law.go.kr and PostgreSQL are both replaced with injected fakes " +
      "(RoutedFakeLawGoKrHttpClient, FakeLegalDocumentRepository); OpenSearch reindexing uses FakeOpenSearchClient. " +
      "Runtime, Composition, Prompt, Retriever, search algorithms, evaluation metrics, the OpenSearch mapping, the " +
      "AI Provider, and the existing detail parser are never modified.",
  );

  console.log("[pipeline] Checking the runner reuses the existing pipeline components (no parallel pipeline)...");
  assertExistingPipelineReuse();

  console.log(
    "[pipeline] Checking the full search-to-detail-to-PostgreSQL flow: dedupe, article ids, sourceType, chapter-heading protection...",
  );
  const { repository } = await validateFullPersistenceEndToEnd();

  console.log("[pipeline] Checking a repeated import introduces no duplicates...");
  await validateRepeatedImportDoesNotDuplicate(repository);

  console.log("[pipeline] Checking a partial detail-fetch failure does not discard successful statutes...");
  await validatePartialDetailFailureDoesNotDiscardSuccessfulStatutes();

  console.log("[pipeline] Checking the reused LawGoKrStatuteDetailParser's chapter-heading protection is unmodified...");
  await validateDetailParserChapterHeadingProtectionUnmodified();

  console.log("[pipeline] Checking PostgreSQL reindex rebuilds article-level OpenSearch documents (injected fake dependencies)...");
  await validatePostgreSQLReindexProducesArticleLevelOpenSearchDocuments(repository);

  console.log("[pipeline] Checking the reindex CLI (pnpm db:legal:reindex) composes the real OpenSearch client/config...");
  assertReindexCliUsesRealOpenSearchComposition();

  console.log("Law.go.kr PostgreSQL persistence pipeline validation succeeded.");
}

main();
