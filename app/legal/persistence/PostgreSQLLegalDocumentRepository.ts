import type { LegalDocumentEntity } from "./LegalDocumentEntity";
import type { LegalDocumentRepository } from "./LegalDocumentRepository";
import type { PostgreSQLClient } from "./PostgreSQLClient";

interface LegalDocumentRow {
  id: string;
  source: string;
  document_id: string;
  title: string;
  content: string;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

function toEntity(row: LegalDocumentRow): LegalDocumentEntity {
  return {
    id: row.id,
    source: row.source,
    documentId: row.document_id,
    title: row.title,
    content: row.content,
    rawData:
      typeof row.raw_data === "string"
        ? row.raw_data
        : JSON.stringify(row.raw_data),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const UPSERT_SQL = `
INSERT INTO legal_documents (id, source, document_id, title, content, raw_data, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
ON CONFLICT (document_id) DO UPDATE SET
  id = EXCLUDED.id,
  source = EXCLUDED.source,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  raw_data = EXCLUDED.raw_data,
  updated_at = EXCLUDED.updated_at;
`;

const FIND_BY_DOCUMENT_ID_SQL = `
SELECT id, source, document_id, title, content, raw_data, created_at, updated_at
FROM legal_documents
WHERE document_id = $1;
`;

const EXISTS_BY_DOCUMENT_ID_SQL = `
SELECT 1 FROM legal_documents WHERE document_id = $1;
`;

const FIND_ALL_SQL = `
SELECT id, source, document_id, title, content, raw_data, created_at, updated_at
FROM legal_documents;
`;

export class PostgreSQLLegalDocumentRepository
  implements LegalDocumentRepository
{
  constructor(private readonly client: PostgreSQLClient) {}

  async save(
    entity: LegalDocumentEntity,
    client: PostgreSQLClient = this.client,
  ): Promise<void> {
    await client.query(UPSERT_SQL, [
      entity.id,
      entity.source,
      entity.documentId,
      entity.title,
      entity.content,
      entity.rawData,
      entity.createdAt,
      entity.updatedAt,
    ]);
  }

  async saveAll(entities: LegalDocumentEntity[]): Promise<void> {
    await this.client.transaction(async (transactionClient) => {
      for (const entity of entities) {
        await this.save(entity, transactionClient);
      }
    });
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<LegalDocumentEntity | null> {
    const result = await this.client.query<LegalDocumentRow>(
      FIND_BY_DOCUMENT_ID_SQL,
      [documentId],
    );
    const row = result.rows[0];
    return row ? toEntity(row) : null;
  }

  async existsByDocumentId(documentId: string): Promise<boolean> {
    const result = await this.client.query(EXISTS_BY_DOCUMENT_ID_SQL, [
      documentId,
    ]);
    return result.rowCount > 0;
  }

  async findAll(): Promise<LegalDocumentEntity[]> {
    const result = await this.client.query<LegalDocumentRow>(FIND_ALL_SQL);
    return result.rows.map(toEntity);
  }
}
