import type { PostgreSQLClient } from "./PostgreSQLClient";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS legal_import_histories (
  id text PRIMARY KEY,
  source text NOT NULL,
  query text NOT NULL,
  imported_count integer NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  error_message text
);
`;

export class PostgreSQLImportHistorySchemaInitializer {
  constructor(private readonly client: PostgreSQLClient) {}

  async initialize(): Promise<void> {
    await this.client.query(CREATE_TABLE_SQL);
  }
}
