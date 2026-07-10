import { readFileSync } from "node:fs";
import path from "node:path";
import type { HttpClient } from "./http";
import {
  runLawGoKrOpenSearchIndexing,
  type LawGoKrOpenSearchIndexingSummary,
} from "./runLawGoKrOpenSearchIndexing";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import { OpenSearchBulkIndexError } from "../search/opensearch/OpenSearchBulkIndexError";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import { createOpenSearchConfigFromEnv } from "../search/opensearch/OpenSearchConfigFactory";
import type { OpenSearchLegalDocument } from "../search/opensearch/OpenSearchLegalDocument";

const FAKE_OC = "fake-oc-for-validation-only";

const TWO_STATUTE_RESPONSE = JSON.stringify({
  LawSearch: {
    law: [
      {
        법령ID: "law-1",
        법령명한글: "개인정보 보호법",
        법령구분명: "법률",
        소관부처명: "개인정보보호위원회",
        공포일자: "20200101",
        시행일자: "20200101",
      },
      {
        법령ID: "law-2",
        법령명한글: "정보통신망 이용촉진 및 정보보호 등에 관한 법률",
        법령구분명: "법률",
        소관부처명: "과학기술정보통신부",
        공포일자: "20190101",
        시행일자: "20190101",
      },
    ],
  },
});

const EMPTY_RESPONSE = JSON.stringify({ LawSearch: { law: [] } });

class FakeLawGoKrHttpClient implements HttpClient {
  constructor(private readonly content: string) {}

  async get(): Promise<string> {
    return this.content;
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

async function validateSuccessfulIndexingAndStableIds(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new FakeLawGoKrHttpClient(TWO_STATUTE_RESPONSE);
    const openSearchClient = new FakeOpenSearchClient();

    const firstRun = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });

    assertEqual(firstRun.totalCount, 2, "expected two parsed statute documents");
    assertEqual(firstRun.indexedCount, 2, "expected both documents to be indexed");
    assertEqual(firstRun.failedCount, 0, "expected no failed documents");
    assertEqual(firstRun.failedDocumentIds.length, 0, "expected no failed document ids");

    const secondRun = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });
    assertEqual(
      secondRun.indexedCount,
      2,
      "expected a repeated indexing run to still report the same indexed count",
    );

    const searchResults = (await openSearchClient.search(firstRun.targetIndex, {
      query: { multi_match: { query: "개인정보" } },
    })) as { hits: { hits: unknown[] } };
    assertEqual(
      searchResults.hits.hits.length,
      1,
      "expected stable document ids: re-indexing the same source data must overwrite, not duplicate, documents",
    );
  });
}

async function validatePartialFailureIsReported(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new FakeLawGoKrHttpClient(TWO_STATUTE_RESPONSE);
    const openSearchClient = new AlwaysFailingIdOpenSearchClient(
      new FakeOpenSearchClient(),
      "law-2",
    );

    const summary = await runLawGoKrOpenSearchIndexing({
      httpClient,
      openSearchClient,
      query: "개인정보",
    });

    assertEqual(summary.totalCount, 2, "expected two parsed statute documents");
    assertEqual(summary.indexedCount, 1, "expected exactly one document to succeed");
    assertEqual(summary.failedCount, 1, "expected exactly one document to fail");
    assertEqual(
      summary.failedDocumentIds.includes("law-2"),
      true,
      "expected the failing document id to be reported in failedDocumentIds",
    );
    assertEqual(
      summary.indexedCount + summary.failedCount,
      summary.totalCount,
      "expected indexed + failed counts to reconcile with the total, i.e. the runner does not falsely report complete success",
    );
  });
}

async function validateEmptyResultIsRejected(): Promise<void> {
  await withLawGoKrEnv(async () => {
    const httpClient = new FakeLawGoKrHttpClient(EMPTY_RESPONSE);
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

    assertTruthy(threw, "expected an empty parsed result to reject rather than report success");
    assertTruthy(
      message.includes("empty result"),
      "expected the empty-result error to clearly identify the empty-result stage",
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
        httpClient: new FakeLawGoKrHttpClient(TWO_STATUTE_RESPONSE),
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

async function main(): Promise<void> {
  console.log(
    "[pipeline] No external services required: law.go.kr and OpenSearch are both replaced with injected fakes.",
  );

  console.log("[pipeline] Checking the runner reuses the existing pipeline components...");
  assertExistingPipelineReuse();

  console.log(
    "[pipeline] Checking successful indexing and stable document ids across repeated runs...",
  );
  await validateSuccessfulIndexingAndStableIds();

  console.log("[pipeline] Checking partial bulk-indexing failure is reported accurately...");
  await validatePartialFailureIsReported();

  console.log("[pipeline] Checking an empty parsed result is rejected, not reported as success...");
  await validateEmptyResultIsRejected();

  console.log(
    "[pipeline] Checking the runner targets the same createOpenSearchConfigFromEnv() index used by the search runtime...",
  );
  await validateSameIndexConfigurationSource();

  console.log("Law.go.kr OpenSearch indexing pipeline validation succeeded.");
}

main();
