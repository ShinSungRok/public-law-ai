import { readFileSync } from "node:fs";
import path from "node:path";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import type { OpenSearchLegalDocument } from "../search/opensearch/OpenSearchLegalDocument";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

const SAMPLE_QUERY = "개인정보 보호";
const SAMPLE_IN_MEMORY_DOCUMENT_ID = "fake-statute-article-1";

class RecordingOpenSearchClient implements OpenSearchClient {
  public readonly searchCalls: Array<{ indexName: string; body: unknown }> = [];

  constructor(private readonly delegate: OpenSearchClient) {}

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

  bulkIndex(indexName: string, documents: OpenSearchLegalDocument[]): Promise<void> {
    return this.delegate.bulkIndex(indexName, documents);
  }

  async search(indexName: string, body: unknown): Promise<unknown> {
    this.searchCalls.push({ indexName, body });
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

function readFactorySource(): string {
  return readFileSync(
    path.resolve(
      process.cwd(),
      "app/legal/composition/DefaultApplicationContextFactory.ts",
    ),
    "utf8",
  );
}

function countOccurrences(source: string, pattern: RegExp): number {
  return source.match(pattern)?.length ?? 0;
}

function assertSearchSelectionHappensExactlyOnce(): void {
  const source = readFactorySource();

  assertEqual(
    countOccurrences(source, /this\.createRetriever\(\)/g),
    1,
    "expected DefaultApplicationContextFactory to select the retriever exactly once via createRetriever()",
  );
  assertEqual(
    countOccurrences(source, /new OpenSearchSearchEngine\(/g),
    1,
    "expected exactly one OpenSearchSearchEngine construction site (only reached for opensearch configuration)",
  );
  assertEqual(
    countOccurrences(source, /new SearchEngineRetriever\(/g),
    1,
    "expected exactly one SearchEngineRetriever construction site",
  );
  assertEqual(
    countOccurrences(source, /new KeywordRetriever\(/g),
    1,
    "expected exactly one KeywordRetriever construction site",
  );
  assertTruthy(
    /new GenerateRagAnswerUseCase\(\s*retriever,/.test(source),
    "expected GenerateRagAnswerUseCase to receive the single configured retriever variable",
  );
  assertTruthy(
    source.includes("createOpenSearchConfigFromEnv"),
    "expected DefaultApplicationContextFactory to reuse the existing OpenSearch configuration factory rather than reimplementing it",
  );
  assertTruthy(
    source.includes("shouldUseOpenSearchEngine"),
    "expected DefaultApplicationContextFactory to reuse the existing OpenSearch module's engine-selection helper",
  );
  assertTruthy(
    !/SearchConfiguration|SearchEngineType/.test(source),
    "DefaultApplicationContextFactory.ts must not evolve ApplicationConfiguration/SearchConfiguration for engine selection",
  );
  assertTruthy(
    !/process\.env/.test(source),
    "DefaultApplicationContextFactory.ts must not read environment variables directly; env reading stays centralized (EnvironmentApplicationConfigurationFactory / OpenSearchConfigFactory)",
  );
}

async function validateInMemoryConfigurationWiresInMemoryRuntime(): Promise<void> {
  delete process.env.SEARCH_ENGINE;
  delete process.env.OPENSEARCH_NODE;
  delete process.env.OPENSEARCH_INDEX_NAME;
  delete process.env.OPENSEARCH_USERNAME;
  delete process.env.OPENSEARCH_PASSWORD;

  const context = new DefaultApplicationContextFactory().create();

  const ragAnswer = await context.ragController.answer({ query: SAMPLE_QUERY });
  assertTruthy(
    ragAnswer.citations.some(
      (citation) => citation.sourceId === SAMPLE_IN_MEMORY_DOCUMENT_ID,
    ),
    "expected in-memory configuration to retrieve the existing sample legal document",
  );
}

async function validateOpenSearchConfigurationWiresOpenSearchRuntime(): Promise<void> {
  process.env.SEARCH_ENGINE = "opensearch";
  process.env.OPENSEARCH_NODE = "http://fake-opensearch:9200";
  process.env.OPENSEARCH_INDEX_NAME = "public-law-ai-validation";

  try {
    const recordingClient = new RecordingOpenSearchClient(new FakeOpenSearchClient());
    const context = new DefaultApplicationContextFactory(recordingClient).create();

    const ragAnswer = await context.ragController.answer({ query: SAMPLE_QUERY });
    assertTruthy(
      typeof ragAnswer.answer === "string" && ragAnswer.answer.length > 0,
      "expected a well-formed RAG answer when backed by the OpenSearch runtime",
    );

    assertEqual(
      recordingClient.searchCalls.length,
      1,
      "expected the RAG use case to call the OpenSearch client exactly once for a single query",
    );
    assertEqual(
      recordingClient.searchCalls[0].indexName,
      "public-law-ai-validation",
      "expected the OpenSearch search call to use the configured index name",
    );
  } finally {
    delete process.env.SEARCH_ENGINE;
    delete process.env.OPENSEARCH_NODE;
    delete process.env.OPENSEARCH_INDEX_NAME;
  }
}

async function main(): Promise<void> {
  console.log(
    "[composition] Checking search implementation selection happens exactly once...",
  );
  assertSearchSelectionHappensExactlyOnce();

  console.log(
    "[composition] Checking in-memory configuration wires the existing in-memory runtime...",
  );
  await validateInMemoryConfigurationWiresInMemoryRuntime();

  console.log(
    "[composition] Checking opensearch configuration wires the existing OpenSearch runtime (no live cluster required)...",
  );
  await validateOpenSearchConfigurationWiresOpenSearchRuntime();

  console.log("Application context search wiring validation succeeded.");
}

main();
