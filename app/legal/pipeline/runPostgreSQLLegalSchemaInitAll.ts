import {
  PgPostgreSQLClient,
  PostgreSQLImportHistorySchemaInitializer,
  PostgreSQLLegalDocumentSchemaInitializer,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";

async function main(): Promise<void> {
  const config = createPostgreSQLConfigFromEnv();
  assertPostgreSQLConfig(config);

  const client = new PgPostgreSQLClient(config);

  const legalDocumentSchemaInitializer =
    new PostgreSQLLegalDocumentSchemaInitializer(client);
  await legalDocumentSchemaInitializer.initialize();

  const importHistorySchemaInitializer =
    new PostgreSQLImportHistorySchemaInitializer(client);
  await importHistorySchemaInitializer.initialize();

  console.log(
    "legal_documents and legal_import_histories tables initialized successfully.",
  );
}

main();
