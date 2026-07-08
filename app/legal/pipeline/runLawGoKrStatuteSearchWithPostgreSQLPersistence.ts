import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentRepository,
  PostgreSQLLegalDocumentSchemaInitializer,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";
import { FetchHttpClient } from "./http";
import { PublicLegalDataPipeline } from "./index";
import {
  LawGoKrStatuteSearchDownloader,
  LawGoKrStatuteSearchParser,
  assertLawGoKrConfig,
  createLawGoKrConfigFromEnv,
  createLawGoKrSource,
} from "./source";

const QUERY = "개인정보";
const TABLE_NAME = "legal_documents";

async function main(): Promise<void> {
  const lawGoKrConfig = createLawGoKrConfigFromEnv();
  assertLawGoKrConfig(lawGoKrConfig);

  const postgresConfig = createPostgreSQLConfigFromEnv();
  assertPostgreSQLConfig(postgresConfig);

  const client = new PgPostgreSQLClient(postgresConfig);
  const schemaInitializer = new PostgreSQLLegalDocumentSchemaInitializer(
    client,
  );
  await schemaInitializer.initialize();

  const repository = new PostgreSQLLegalDocumentRepository(client);

  const source = createLawGoKrSource();
  const httpClient = new FetchHttpClient();

  const pipeline = new PublicLegalDataPipeline(
    new LawGoKrStatuteSearchDownloader(httpClient, lawGoKrConfig, QUERY),
    new LawGoKrStatuteSearchParser(),
  );

  const useCase = new ImportStatutesUseCase(pipeline, undefined, repository);
  const importedResults = await useCase.execute(source);

  console.log(`Imported count: ${importedResults.length}`);
  console.log(`PostgreSQL table: ${TABLE_NAME}`);
}

main();
