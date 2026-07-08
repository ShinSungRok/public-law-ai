import type { LegalDocument } from "../domain";
import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentRepository,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";

const QUERY = "개인정보";

async function main(): Promise<void> {
  const postgresConfig = createPostgreSQLConfigFromEnv();
  assertPostgreSQLConfig(postgresConfig);

  const client = new PgPostgreSQLClient(postgresConfig);
  const repository = new PostgreSQLLegalDocumentRepository(client);

  const entities = await repository.findAll();

  const openSearchConfig: OpenSearchConfig = {
    node: "fake://local-opensearch",
    indexName: "legal-documents",
  };
  const openSearchClient = new FakeOpenSearchClient();
  const indexManager = new OpenSearchIndexManager(
    openSearchClient,
    openSearchConfig,
  );
  const indexer = new OpenSearchLegalDocumentIndexer(
    openSearchClient,
    openSearchConfig,
  );

  await indexManager.ensureLegalIndex();

  const documents = entities.map(
    (entity) => JSON.parse(entity.rawData) as LegalDocument,
  );
  await indexer.indexAll(documents);
  const indexedCount = documents.length;

  const searchEngine = new OpenSearchSearchEngine(
    openSearchClient,
    openSearchConfig,
  );
  const searchResults = await searchEngine.search({ text: QUERY });

  console.log(`Loaded count: ${entities.length}`);
  console.log(`Indexed count: ${indexedCount}`);
  console.log(`Search result count: ${searchResults.length}`);
}

main();
