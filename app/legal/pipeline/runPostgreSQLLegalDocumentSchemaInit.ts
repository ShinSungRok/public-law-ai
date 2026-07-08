import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentSchemaInitializer,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";

async function main(): Promise<void> {
  const config = createPostgreSQLConfigFromEnv();
  assertPostgreSQLConfig(config);

  const client = new PgPostgreSQLClient(config);
  const initializer = new PostgreSQLLegalDocumentSchemaInitializer(client);

  await initializer.initialize();

  console.log("legal_documents table initialized successfully.");
}

main();
