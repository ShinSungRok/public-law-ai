import type { PostgreSQLClient } from "./PostgreSQLClient";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS legal_documents (
  id text PRIMARY KEY,
  source text NOT NULL,
  document_id text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  raw_data jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
`;

export class PostgreSQLLegalDocumentSchemaInitializer {
  constructor(private readonly client: PostgreSQLClient) {}

  async initialize(): Promise<void> {
    await this.client.query(CREATE_TABLE_SQL);
  }
}
