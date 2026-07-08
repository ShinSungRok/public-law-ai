import type { ImportHistoryEntity } from "./ImportHistoryEntity";
import type { ImportHistoryRepository } from "./ImportHistoryRepository";
import type { PostgreSQLClient } from "./PostgreSQLClient";

interface ImportHistoryRow {
  id: string;
  source: string;
  query: string;
  imported_count: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

function toEntity(row: ImportHistoryRow): ImportHistoryEntity {
  return {
    id: row.id,
    source: row.source,
    query: row.query,
    importedCount: row.imported_count,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
    errorMessage: row.error_message,
  };
}

const UPSERT_SQL = `
INSERT INTO legal_import_histories (id, source, query, imported_count, status, started_at, finished_at, error_message)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE SET
  source = EXCLUDED.source,
  query = EXCLUDED.query,
  imported_count = EXCLUDED.imported_count,
  status = EXCLUDED.status,
  started_at = EXCLUDED.started_at,
  finished_at = EXCLUDED.finished_at,
  error_message = EXCLUDED.error_message;
`;

const FIND_ALL_SQL = `
SELECT id, source, query, imported_count, status, started_at, finished_at, error_message
FROM legal_import_histories
ORDER BY started_at DESC;
`;

export class PostgreSQLImportHistoryRepository
  implements ImportHistoryRepository
{
  constructor(private readonly client: PostgreSQLClient) {}

  async save(entity: ImportHistoryEntity): Promise<void> {
    await this.client.query(UPSERT_SQL, [
      entity.id,
      entity.source,
      entity.query,
      entity.importedCount,
      entity.status,
      entity.startedAt,
      entity.finishedAt,
      entity.errorMessage,
    ]);
  }

  async findAll(): Promise<ImportHistoryEntity[]> {
    const result = await this.client.query<ImportHistoryRow>(FIND_ALL_SQL);
    return result.rows.map(toEntity);
  }
}
