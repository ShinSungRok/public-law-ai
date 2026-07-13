import { readFileSync } from "node:fs";
import path from "node:path";
import type { HttpClient } from "./http";
import {
  runLawGoKrOpenSearchIndexing,
  type LawGoKrOpenSearchIndexingSummary,
} from "./runLawGoKrOpenSearchIndexing";
import { LawGoKrStatuteDetailParser } from "./source/LawGoKrStatuteDetailParser";
import { buildLawGoKrStatuteDetailUrl } from "./source/LawGoKrUrlBuilder";
import type { RawLegalData } from "./RawLegalData";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import { OpenSearchBulkIndexError } from "../search/opensearch/OpenSearchBulkIndexError";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import { createOpenSearchConfigFromEnv } from "../search/opensearch/OpenSearchConfigFactory";
import type { OpenSearchLegalDocument } from "../search/opensearch/OpenSearchLegalDocument";

const FAKE_OC = "fake-oc-for-validation-only";

// -- Fixtures --------------------------------------------------------------
//
// SEARCH_RESPONSE lists three law.go.kr search hits: "law-1" appears twice
// (simulating a duplicate/historical-version repeat that must be downloaded
// only once) and "law-2" once.
const SEARCH_RESPONSE = JSON.stringify({
  LawSearch: {
    law: [
      { 법령ID: "law-1", 법령명한글: "개인정보 보호법", 법령구분명: "법률" },
      { 법령ID: "law-2", 법령명한글: "정보통신망법", 법령구분명: "법률" },
      { 법령ID: "law-1", 법령명한글: "개인정보 보호법", 법령구분명: "법률" },
    ],
  },
});

const EMPTY_SEARCH_RESPONSE = JSON.stringify({ LawSearch: { law: [] } });

// law-1 detail: article 2 (usable), article 3 (blank -> must be skipped),
// article 15-2 (branch number -> must produce id "law-1:15-2").
const LAW_1_DETAIL_RESPONSE = JSON.stringify({
  법령: {
    기본정보: {
      법령명_한글: "개인정보 보호법",
      공포일자: "20200101",
      시행일자: "20200101",
    },
    조문: {
      조문단위: [
        {
          조문번호: "2",
          조문가지번호: "0",
          조문제목: "정의",
          조문내용: "제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.",
          항: [
            {
              항번호: "1",
              항내용: "1. \"개인정보\"란 살아있는 개인에 관한 정보를 말한다.",
            },
          ],
        },
        {
          조문번호: "3",
          조문가지번호: "0",
          조문제목: "",
          조문내용: "",
        },
        {
          조문번호: "15",
          조문가지번호: "2",
          조문제목: "손해배상책임",
          조문내용: "제15조의2(손해배상책임) 개인정보처리자는 이 법을 위반한 행위로 정보주체에게 손해를 발생시킨 경우 그 손해를 배상할 책임이 있다.",
        },
      ],
    },
  },
});

// law-2 detail: a single usable article.
const LAW_2_DETAIL_RESPONSE = JSON.stringify({
  법령: {
    기본정보: {
      법령명_한글: "정보통신망법",
      공포일자: "20190101",
      시행일자: "20190101",
    },
    조문: {
      조문단위: [
        {
          조문번호: "3",
          조문가지번호: "0",
          조문제목: "국가등의 책무",
          조문내용: "제3조(국가등의 책무) 정부는 정보통신망의 이용촉진 및 안정적 관리ㆍ운영과 정보보호를 위한 시책을 마련하여야 한다.",
        },
      ],
    },
  },
});

// law-4 detail: reproduces the real production collision (see
// public-law-ai-local docs "011357:15/29/35") — a 장(chapter) heading
// pseudo-entry ("제4장 개인정보의 안전한 관리") shares 조문번호="29" with the
// real 제29조(안전조치의무) article that starts that chapter. Before the
// fix, whichever of the two happened to be seen first for a given id "won"
// and the other was silently dropped; here the heading appears first, so it
// used to overwrite/shadow the real article.
const LAW_4_CHAPTER_HEADING_COLLISION_DETAIL_RESPONSE = JSON.stringify({
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
          // 조문내용 is purely a "제N장 ..." heading line — collides on
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
      ],
    },
  },
});

// law-3 detail: metadata only, no 조문 section at all.
const METADATA_ONLY_DETAIL_RESPONSE = JSON.stringify({
  법령: {
    기본정보: {
      법령명_한글: "메타데이터만있는법",
      공포일자: "20180101",
      시행일자: "20180101",
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

class AlwaysFailingIdOpenSearchClient implements OpenSearchClient {
  constructor(
    private readonly delegate: OpenSearchClient,
    private readonly failingId: string,
  ) {}

  indexExists(indexName: string): Promise<boolean> {
    return this.delegate.indexExists(indexName);
  }

  createIndex(indexName: string, mapping: unknown): Promise<void> {
    return this.delegate.createIndex(indexName, mapping);
  }

  indexDocument(
    indexName: string,
    id: string,
    document: OpenSearchLegalDocument,
  ): Promise<void> {
    return this.delegate.indexDocument(indexName, id, document);
  }

  async bulkIndex(
    indexName: string,
    documents: OpenSearchLegalDocument[],
  ): Promise<void> {
    const succeeding = documents.filter((document) => document.id !== this.failingId);
    await this.delegate.bulkIndex(indexName, succeeding);

    if (documents.some((document) => document.id === this.failingId)) {
      throw new OpenSearchBulkIndexError([this.failingId]);
    }
  }

  search(indexName: string, body: unknown): Promise<unknown> {
    return this.delegate.search(indexName, body);
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
    path.resolve(process.cwd(), "app/legal/pipeline/runLawGoKrOpenSearchIndexing.ts"),
    "utf8",
  );
}

function assertExistingPipelineReuse(): void {
  const source = readRunnerSource();

  const requiredReferences = [
    "LawGoKrStatuteSearchDownloader",
    "LawGoKrStatuteSearchParser",
    "LawGoKrStatuteDetailDownloader",
    "LawGoKrStatuteDetailParser",
    "PublicLegalDataPipeline",
    "createLawGoKrConfigFromEnv",
    "assertLawGoKrConfig",
    "OpenSearchIndexManager",
    "OpenSearchLegalDocumentIndexer",
    "createOpenSearchConfigFromEnv",
  ];
  for (const reference of requiredReferences) {
    assertTruthy(
      source.includes(reference),
      `runLawGoKrOpenSearchIndexing.ts does not reuse the existing ${reference}`,
    );
  }

  assertTruthy(
    !/class\s+\w+\s+implements\s+(PublicLegalDataDownloader|PublicLegalDataParser|OpenSearchClient)\b/.test(
      source,
    ),
    "runLawGoKrOpenSearchIndexing.ts must not define a duplicate downloader/parser/OpenSearch client implementation",
  );

  assertTruthy(
    !/https?:\/\/(?!.*\[REDACTED\]).*law\.go\.kr/i.test(source) &&
      !source.includes("localhost:9200"),
    "runLawGoKrOpenSearchIndexing.ts must not hard-code a real external endpoint",
  );
}

async function validateFullContentIndexingEndToEnd(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(SEARCH_RESPONSE, {
      "law-1": LAW_1_DETAIL_RESPONSE,
      "law-2": LAW_2_DETAIL_RESPONSE,
    });
    const openSearchClient = new FakeOpenSearchClient();

    const summary = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });

    // Search-to-detail flow: duplicate search identifiers downloaded once.
    assertEqual(summary.statuteCount, 2, "expected two distinct statutes after dedupe");
    assertEqual(
      httpClient.detailCallCountById.get("law-1"),
      1,
      "expected the duplicate law-1 search hit to trigger exactly one detail request",
    );
    assertEqual(
      httpClient.detailCallCountById.get("law-2"),
      1,
      "expected exactly one detail request for law-2",
    );

    // Article-level documents: 2 usable articles from law-1 (blank article-3 skipped) + 1 from law-2.
    assertEqual(summary.totalCount, 3, "expected 3 article-level documents across both statutes");
    assertEqual(summary.indexedCount, 3, "expected all 3 article documents to be indexed");
    assertEqual(summary.failedCount, 0, "expected no bulk-indexing failures");
    assertEqual(summary.detailFailedStatuteIds.length, 0, "expected no detail-fetch failures");
    assertEqual(summary.detailEmptyStatuteIds.length, 0, "expected no empty-detail statutes");

    const searchResults = (await openSearchClient.search(summary.targetIndex, {
      query: { multi_match: { query: "개인정보 정보통신망" } },
      size: 10,
    })) as { hits: { hits: { _id: string; _source: OpenSearchLegalDocument }[] } };
    const indexedById = new Map(
      searchResults.hits.hits.map((hit) => [hit._id, hit._source]),
    );

    assertTruthy(
      indexedById.has("law-1:2") && indexedById.has("law-1:15-2") && indexedById.has("law-2:3"),
      "expected stable, composite article ids (statuteId:articleNo)",
    );
    assertTruthy(
      !indexedById.has("law-1:3"),
      "expected the blank article (law-1:3) to be skipped rather than indexed",
    );

    const article2 = indexedById.get("law-1:2")!;
    assertTruthy(
      article2.text.includes("살아있는 개인에 관한 정보를 말한다"),
      "expected indexed text to contain real article body content, not just metadata",
    );
    assertTruthy(
      article2.title.includes("개인정보 보호법") && article2.title.includes("제2조"),
      "expected the article title to carry statute + article context",
    );

    const article15 = indexedById.get("law-1:15-2")!;
    assertTruthy(
      article15.text.includes("손해를 배상할 책임이 있다"),
      "expected the branch-numbered article's body text to be indexed",
    );

    // Repeated indexing must overwrite, not duplicate.
    const secondRun = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });
    assertEqual(
      secondRun.indexedCount,
      3,
      "expected a repeated run to report the same indexed count",
    );
    const rerunSearch = (await openSearchClient.search(summary.targetIndex, {
      query: { multi_match: { query: "개인정보 정보통신망" } },
      size: 10,
    })) as { hits: { hits: unknown[] } };
    assertEqual(
      rerunSearch.hits.hits.length,
      3,
      "expected stable document ids: re-indexing must overwrite, not duplicate, documents",
    );
  });
}

async function validateDetailParserOrderingAndIdentity(): Promise<void> {
  const parser = new LawGoKrStatuteDetailParser();
  const rawData: RawLegalData = {
    id: "law.go.kr:statute-detail:law-1",
    sourceSystem: "law.go.kr",
    sourceId: "law-1",
    rawFormat: "json",
    content: LAW_1_DETAIL_RESPONSE,
    collectedAt: "2026-07-13T00:00:00Z",
  };

  const parsed = await parser.parse(rawData);

  assertEqual(parsed.length, 2, "expected 2 usable articles (blank article-3 skipped)");
  assertEqual(
    parsed[0].document.id,
    "law-1:2",
    "expected deterministic ordering: article 2 must come first",
  );
  assertEqual(
    parsed[1].document.id,
    "law-1:15-2",
    "expected deterministic ordering: article 15-2 must come second",
  );
  assertEqual(
    parsed[0].document.sourceRef.sourceId,
    "law-1:2",
    "expected sourceRef.sourceId to match the composite article id",
  );
  assertEqual(
    parsed[0].document.metadata.sourceId,
    "law-1",
    "expected metadata.sourceId to preserve the original law.go.kr statute identifier separately",
  );
  assertTruthy(
    parsed[0].document.metadata.sourceUrl.includes("lawService.do"),
    "expected a deterministic law.go.kr source URL to be populated",
  );

  // Re-parsing the same content must not introduce duplicate documents.
  const reparsed = await parser.parse(rawData);
  assertEqual(reparsed.length, 2, "expected re-parsing identical content to be idempotent");
}

async function validateEmptyOrMetadataOnlyDetailIsSkipped(): Promise<void> {
  const parser = new LawGoKrStatuteDetailParser();
  const rawData: RawLegalData = {
    id: "law.go.kr:statute-detail:law-3",
    sourceSystem: "law.go.kr",
    sourceId: "law-3",
    rawFormat: "json",
    content: METADATA_ONLY_DETAIL_RESPONSE,
    collectedAt: "2026-07-13T00:00:00Z",
  };

  const parsed = await parser.parse(rawData);
  assertEqual(
    parsed.length,
    0,
    "expected a metadata-only detail response (no 조문 section) to produce zero documents",
  );
}

async function validateChapterHeadingsDoNotOverwriteArticles(): Promise<void> {
  const parser = new LawGoKrStatuteDetailParser();
  const rawData: RawLegalData = {
    id: "law.go.kr:statute-detail:law-4",
    sourceSystem: "law.go.kr",
    sourceId: "law-4",
    rawFormat: "json",
    content: LAW_4_CHAPTER_HEADING_COLLISION_DETAIL_RESPONSE,
    collectedAt: "2026-07-13T00:00:00Z",
  };

  const parsed = await parser.parse(rawData);

  // Only the two real articles (28-9, 29) should be produced — the chapter
  // heading pseudo-entry must not become a document of its own.
  assertEqual(
    parsed.length,
    2,
    "expected only the two real articles to be produced (chapter heading skipped)",
  );

  const ids = parsed.map((p) => p.document.id);
  assertEqual(
    new Set(ids).size,
    ids.length,
    "expected no duplicate document ids even though the heading and the real article shared 조문번호=29",
  );
  assertTruthy(
    !ids.some((id) => id === "law-4:4"),
    "chapter number itself (4) must never be produced as an article id",
  );

  const article29 = parsed.find((p) => p.document.id === "law-4:29");
  assertTruthy(article29, "expected the real 제29조 article to be retained under id law-4:29");
  assertTruthy(
    article29!.document.text.includes("안전성 확보에 필요한 기술적ㆍ관리적 및 물리적 조치"),
    "expected law-4:29 to carry the real article body text",
  );
  assertTruthy(
    !article29!.document.text.includes("제4장 개인정보의 안전한 관리"),
    "expected law-4:29 not to be shadowed by the chapter-heading text",
  );
  assertEqual(
    article29!.document.title,
    "개인정보 보호법 제29조(안전조치의무)",
    "expected the real article's title, not a heading-derived title",
  );

  const article28_9 = parsed.find((p) => p.document.id === "law-4:28-9");
  assertTruthy(
    article28_9,
    "expected the unrelated preceding article (28-9) to be parsed normally, unaffected by the collision",
  );
  assertTruthy(
    article28_9!.document.text.includes("보호위원회는 국외 이전이"),
    "expected law-4:28-9 to retain its own real body text",
  );
}

async function validateDetailFetchPartialFailureIsReported(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(
      SEARCH_RESPONSE,
      { "law-1": LAW_1_DETAIL_RESPONSE, "law-2": LAW_2_DETAIL_RESPONSE },
      new Set(["law-2"]),
    );
    const openSearchClient = new FakeOpenSearchClient();

    const summary = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });

    assertEqual(summary.statuteCount, 2, "expected both statutes to be found by search");
    assertEqual(
      summary.detailFailedStatuteIds.includes("law-2"),
      true,
      "expected the failed detail fetch for law-2 to be reported",
    );
    assertEqual(
      summary.totalCount,
      2,
      "expected only law-1's 2 usable articles to be indexed after law-2's detail fetch failed",
    );
    assertEqual(summary.indexedCount, 2, "expected law-1's articles to still be indexed");
    assertTruthy(
      summary.detailFailedStatuteIds.length > 0,
      "expected the summary to avoid falsely reporting complete success",
    );
  });
}

async function validateBulkIndexPartialFailureIsReported(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(SEARCH_RESPONSE, {
      "law-1": LAW_1_DETAIL_RESPONSE,
      "law-2": LAW_2_DETAIL_RESPONSE,
    });
    const openSearchClient = new AlwaysFailingIdOpenSearchClient(
      new FakeOpenSearchClient(),
      "law-1:15-2",
    );

    const summary = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });

    assertEqual(summary.totalCount, 3, "expected 3 article-level documents to be attempted");
    assertEqual(summary.indexedCount, 2, "expected exactly two documents to succeed");
    assertEqual(summary.failedCount, 1, "expected exactly one document to fail");
    assertEqual(
      summary.failedDocumentIds.includes("law-1:15-2"),
      true,
      "expected the failing article document id to be reported in failedDocumentIds",
    );
    assertEqual(
      summary.indexedCount + summary.failedCount,
      summary.totalCount,
      "expected indexed + failed counts to reconcile with the total, i.e. the runner does not falsely report complete success",
    );
  });
}

async function validateEmptySearchResultIsRejected(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new RoutedFakeLawGoKrHttpClient(EMPTY_SEARCH_RESPONSE, {});
    const openSearchClient = new FakeOpenSearchClient();

    let threw = false;
    let message = "";
    try {
      await runLawGoKrOpenSearchIndexing({
        httpClient,
        openSearchClient,
        query: "존재하지-않는-검색어",
      });
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }

    assertTruthy(threw, "expected an empty search result to reject rather than report success");
    assertTruthy(
      message.includes("empty result"),
      "expected the empty-result error to clearly identify the empty-result stage",
    );
  });
}

async function validateAllStatutesWithoutArticlesIsRejected(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const singleStatuteSearchResponse = JSON.stringify({
      LawSearch: { law: [{ 법령ID: "law-3", 법령명한글: "메타데이터만있는법" }] },
    });
    const httpClient = new RoutedFakeLawGoKrHttpClient(singleStatuteSearchResponse, {
      "law-3": METADATA_ONLY_DETAIL_RESPONSE,
    });
    const openSearchClient = new FakeOpenSearchClient();

    let threw = false;
    let message = "";
    try {
      await runLawGoKrOpenSearchIndexing({
        httpClient,
        openSearchClient,
        query: "메타데이터",
      });
    } catch (error) {
      threw = true;
      message = error instanceof Error ? error.message : String(error);
    }

    assertTruthy(
      threw,
      "expected a metadata-only detail response (no usable articles) to reject rather than index a low-quality document",
    );
    assertTruthy(
      message.includes("empty result"),
      "expected the no-usable-articles error to clearly identify the empty-result stage",
    );
  });
}

async function validateSameIndexConfigurationSource(): Promise<void> {
  process.env.OPENSEARCH_NODE = "http://fake-opensearch:9200";
  process.env.OPENSEARCH_INDEX_NAME = "public-law-ai-validation-index";

  try {
    const expectedConfig = createOpenSearchConfigFromEnv();

    let summary: LawGoKrOpenSearchIndexingSummary;
    await withLawGoKrEnv(async () => {
      summary = await runLawGoKrOpenSearchIndexing({
        httpClient: new RoutedFakeLawGoKrHttpClient(SEARCH_RESPONSE, {
          "law-1": LAW_1_DETAIL_RESPONSE,
          "law-2": LAW_2_DETAIL_RESPONSE,
        }),
        openSearchClient: new FakeOpenSearchClient(),
        query: "개인정보",
      });
    });

    assertEqual(
      summary!.targetIndex,
      expectedConfig.indexName,
      "expected the indexing runner to target the same index name produced by createOpenSearchConfigFromEnv()",
    );
  } finally {
    delete process.env.OPENSEARCH_NODE;
    delete process.env.OPENSEARCH_INDEX_NAME;
  }
}

function assertUrlBuilderUsesDocumentedParameters(): void {
  const url = new URL(
    buildLawGoKrStatuteDetailUrl({ baseUrl: "https://www.law.go.kr", oc: FAKE_OC }, "law-1"),
  );
  assertEqual(url.pathname, "/DRF/lawService.do", "expected the documented detail endpoint path");
  assertEqual(url.searchParams.get("OC"), FAKE_OC, "expected the OC parameter to be forwarded");
  assertEqual(url.searchParams.get("target"), "law", "expected target=law");
  assertEqual(url.searchParams.get("type"), "JSON", "expected type=JSON");
  assertEqual(url.searchParams.get("ID"), "law-1", "expected the statute id forwarded as ID");
}

async function main(): Promise<void> {
  console.log(
    "[pipeline] No external services required: law.go.kr and OpenSearch are both replaced with injected fakes.",
  );

  console.log("[pipeline] Checking the runner reuses the existing pipeline components...");
  assertExistingPipelineReuse();

  console.log("[pipeline] Checking the detail URL builder uses the documented request parameters...");
  assertUrlBuilderUsesDocumentedParameters();

  console.log(
    "[pipeline] Checking the full search-to-detail-to-indexing flow: dedupe, stable ids, full article text, blank-article skipping, idempotent re-indexing...",
  );
  await validateFullContentIndexingEndToEnd();

  console.log(
    "[pipeline] Checking the detail parser preserves article ordering and stable composite ids...",
  );
  await validateDetailParserOrderingAndIdentity();

  console.log(
    "[pipeline] Checking a metadata-only detail response is skipped rather than producing a low-quality document...",
  );
  await validateEmptyOrMetadataOnlyDetailIsSkipped();

  console.log(
    "[pipeline] Checking chapter/section heading pseudo-entries do not overwrite real articles that share their id...",
  );
  await validateChapterHeadingsDoNotOverwriteArticles();

  console.log("[pipeline] Checking a partial detail-fetch failure is reported accurately...");
  await validateDetailFetchPartialFailureIsReported();

  console.log("[pipeline] Checking a partial bulk-indexing failure is reported accurately...");
  await validateBulkIndexPartialFailureIsReported();

  console.log("[pipeline] Checking an empty search result is rejected, not reported as success...");
  await validateEmptySearchResultIsRejected();

  console.log(
    "[pipeline] Checking that statutes with no usable articles at all are rejected, not reported as success...",
  );
  await validateAllStatutesWithoutArticlesIsRejected();

  console.log(
    "[pipeline] Checking the runner targets the same createOpenSearchConfigFromEnv() index used by the search runtime...",
  );
  await validateSameIndexConfigurationSource();

  console.log("Law.go.kr full-content OpenSearch indexing pipeline validation succeeded.");
}

main();
