import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentRepository,
  PostgreSQLLegalDocumentSchemaInitializer,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";
import {
  FakePublicLegalDataDownloader,
  FakePublicLegalDataParser,
  PublicLegalDataPipeline,
} from "./index";
import type { PublicDataSource } from "./PublicDataSource";

const TABLE_NAME = "legal_documents";

async function main(): Promise<void> {
  const config = createPostgreSQLConfigFromEnv();
  assertPostgreSQLConfig(config);

  const client = new PgPostgreSQLClient(config);
  const schemaInitializer = new PostgreSQLLegalDocumentSchemaInitializer(
    client,
  );
  await schemaInitializer.initialize();

  const repository = new PostgreSQLLegalDocumentRepository(client);

  const source: PublicDataSource = {
    sourceSystem: "fake-source",
    sourceName: "Fake Public Legal Data Source",
    baseUrl: "https://fake.local",
  };

  const pipeline = new PublicLegalDataPipeline(
    new FakePublicLegalDataDownloader(),
    new FakePublicLegalDataParser(),
  );

  const useCase = new ImportStatutesUseCase(pipeline, undefined, repository);
  const importedResults = await useCase.execute(source);

  console.log(`Imported count: ${importedResults.length}`);
  console.log(`PostgreSQL table: ${TABLE_NAME}`);
}

main();
