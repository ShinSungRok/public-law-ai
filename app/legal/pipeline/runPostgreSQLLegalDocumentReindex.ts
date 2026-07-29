import type { EmbeddingProvider } from "../embedding";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../persistence";
import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentRepository,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { createOpenSearchConfigFromEnv } from "../search/opensearch/OpenSearchConfigFactory";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSdkClient } from "../search/opensearch/OpenSearchSdkClient";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";

const DEFAULT_QUERY = "개인정보";
const DEFAULT_OPENSEARCH_CONFIG: OpenSearchConfig = {
  node: "fake://local-opensearch",
  indexName: "legal-documents",
};

export interface PostgreSQLLegalDocumentReindexDependencies {
  repository?: LegalDocumentRepository;
  openSearchClient?: OpenSearchClient;
  openSearchConfig?: OpenSearchConfig;
  query?: string;
  /** When provided, every document is embedded (title + text) and indexed with its vector attached; omitted, this reindex stays keyword-only. */
  embeddingProvider?: EmbeddingProvider;
}

export interface PostgreSQLLegalDocumentReindexSummary {
  loadedCount: number;
  totalCount: number;
  indexedCount: number;
  failedCount: number;
  failedDocumentIds: string[];
  searchResultCount: number;
}

/**
 * Rebuilds OpenSearch documents from whatever PostgreSQL currently holds:
 * repository.findAll() -> JSON.parse each entity's rawData back into a
 * LegalDocument -> bulk index. Since runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts
 * now persists article-level LegalDocuments (see toLegalDocumentEntity),
 * this reindex path rebuilds article-level OpenSearch documents whenever
 * PostgreSQL holds article-level rows, with no change needed here.
 */
export async function runPostgreSQLLegalDocumentReindex(
  dependencies: PostgreSQLLegalDocumentReindexDependencies = {},
): Promise<PostgreSQLLegalDocumentReindexSummary> {
  let repository = dependencies.repository;
  if (!repository) {
    const postgresConfig = createPostgreSQLConfigFromEnv();
    assertPostgreSQLConfig(postgresConfig);
    const client = new PgPostgreSQLClient(postgresConfig);
    repository = new PostgreSQLLegalDocumentRepository(client);
  }

  const entities = await repository.findAll();

  const openSearchConfig = dependencies.openSearchConfig ?? DEFAULT_OPENSEARCH_CONFIG;
  const openSearchClient = dependencies.openSearchClient ?? new FakeOpenSearchClient();
  const indexManager = new OpenSearchIndexManager(openSearchClient, openSearchConfig);
  const indexer = new OpenSearchLegalDocumentIndexer(openSearchClient, openSearchConfig);

  await indexManager.ensureLegalIndex();

  const documents = entities.map(
    (entity) => JSON.parse(entity.rawData) as LegalDocument,
  );

  const { embeddingProvider } = dependencies;
  let batchIndexResult;
  if (embeddingProvider) {
    console.log(
      `[reindex] Embedding + indexing ${documents.length} documents (this calls the embedding API once per document)...`,
    );
    const entriesWithEmbeddings = [];
    for (const document of documents) {
      const embedding = await embeddingProvider.embed(`${document.title}\n\n${document.text}`);
      entriesWithEmbeddings.push({ document, embedding });
    }
    batchIndexResult = await indexer.indexAllWithEmbeddings(entriesWithEmbeddings, {
      batchSize: 100,
      maxRetries: 2,
    });
  } else {
    console.log(`[reindex] Starting batch indexing for ${documents.length} documents`);
    batchIndexResult = await indexer.indexAll(documents, {
      batchSize: 100,
      maxRetries: 2,
    });
  }

  const searchEngine = new OpenSearchSearchEngine(openSearchClient, openSearchConfig);
  const query = dependencies.query ?? DEFAULT_QUERY;
  const searchResults = await searchEngine.search({ text: query });

  return {
    loadedCount: entities.length,
    totalCount: batchIndexResult.totalCount,
    indexedCount: batchIndexResult.indexedCount,
    failedCount: batchIndexResult.failedCount,
    failedDocumentIds: batchIndexResult.failedDocumentIds,
    searchResultCount: searchResults.length,
  };
}

function printSummary(summary: PostgreSQLLegalDocumentReindexSummary): void {
  console.log(`Loaded count: ${summary.loadedCount}`);
  console.log(`Total count: ${summary.totalCount}`);
  console.log(`Indexed count: ${summary.indexedCount}`);
  console.log(`Failed count: ${summary.failedCount}`);
  console.log(`Failed document ids: ${summary.failedDocumentIds.join(", ")}`);
  console.log(`Search result count: ${summary.searchResultCount}`);
}

function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let redacted = message;
  for (const secret of secrets) {
    if (secret) {
      redacted = redacted.split(secret).join("[REDACTED]");
    }
  }
  return redacted;
}

function stageError(stage: string, error: unknown, secrets: Array<string | undefined>): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return new Error(`[${stage}] ${redactSecrets(rawMessage, secrets)}`);
}

/**
 * The CLI entrypoint (pnpm db:legal:reindex): unlike
 * runPostgreSQLLegalDocumentReindex's own no-args default (a
 * FakeOpenSearchClient, kept for validations/tests), main() always wires the
 * real, environment-configured OpenSearchSdkClient — reusing
 * createOpenSearchConfigFromEnv/OpenSearchSdkClient exactly as
 * runLawGoKrOpenSearchIndexing.ts does — so a real `pnpm db:legal:reindex`
 * run rebuilds the actual configured OpenSearch index from PostgreSQL.
 * createOpenSearchConfigFromEnv() always resolves node/indexName (it falls
 * back to documented defaults, same as runLawGoKrOpenSearchIndexing.ts
 * relies on) — the only value worth guarding against ever reaching a log
 * line or a rethrown error is the optional OPENSEARCH_PASSWORD, redacted
 * below exactly as runLawGoKrOpenSearchIndexing.ts/
 * runLawGoKrStatuteSearchWithPostgreSQLPersistence.ts already do for their
 * own secrets.
 */
/**
 * Only Gemini has a real EmbeddingProvider today (GeminiEmbeddingProvider,
 * reusing the same LLM_API_KEY as chat completion) — real embeddings are
 * opt-in via LLM_PROVIDER so a plain `pnpm db:legal:reindex` never makes an
 * unexpected paid API call against, say, a fake/openai/anthropic setup.
 */
async function createEmbeddingProviderFromEnv(): Promise<EmbeddingProvider | undefined> {
  if (process.env.LLM_PROVIDER !== "gemini" || !process.env.LLM_API_KEY?.trim()) {
    return undefined;
  }

  const { GeminiEmbeddingProvider } = await import("../embedding/GeminiEmbeddingProvider");
  return new GeminiEmbeddingProvider(process.env.LLM_API_KEY);
}

async function main(): Promise<void> {
  const openSearchConfig = createOpenSearchConfigFromEnv();
  const secrets = [openSearchConfig.password];

  console.log(
    `[reindex] Rebuilding real OpenSearch index "${openSearchConfig.indexName}" at ${openSearchConfig.node} from PostgreSQL...`,
  );

  let summary: PostgreSQLLegalDocumentReindexSummary;
  try {
    const openSearchClient = new OpenSearchSdkClient(openSearchConfig);
    const embeddingProvider = await createEmbeddingProviderFromEnv();
    console.log(
      `[reindex] Embeddings: ${embeddingProvider ? "enabled (Gemini)" : "disabled (keyword-only)"}`,
    );
    summary = await runPostgreSQLLegalDocumentReindex({
      openSearchClient,
      openSearchConfig,
      embeddingProvider,
    });
  } catch (error) {
    throw stageError("reindex", error, secrets);
  }

  printSummary(summary);
}

if (require.main === module) {
  main();
}
