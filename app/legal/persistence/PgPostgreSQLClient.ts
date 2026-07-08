import { Pool } from "pg";

import type {
  PostgreSQLClient,
  PostgreSQLQueryResult,
} from "./PostgreSQLClient";
import type { PostgreSQLConfig } from "./PostgreSQLConfig";

export class PgPostgreSQLClient implements PostgreSQLClient {
  private readonly pool: Pool;

  constructor(config: PostgreSQLConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl,
    });
  }

  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<PostgreSQLQueryResult<T>> {
    const result = await this.pool.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }
}
