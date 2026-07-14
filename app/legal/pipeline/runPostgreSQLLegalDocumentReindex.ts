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
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
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
  console.log(`[reindex] Starting batch indexing for ${documents.length} documents`);
  const batchIndexResult = await indexer.indexAll(documents, {
    batchSize: 100,
    maxRetries: 2,
  });

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

async function main(): Promise<void> {
  const summary = await runPostgreSQLLegalDocumentReindex();
  printSummary(summary);
}

if (require.main === module) {
  main();
}
