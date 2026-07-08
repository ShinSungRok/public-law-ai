import { Pool, type PoolClient } from "pg";

import type {
  PostgreSQLClient,
  PostgreSQLQueryResult,
} from "./PostgreSQLClient";
import type { PostgreSQLConfig } from "./PostgreSQLConfig";

class PoolClientPostgreSQLClient implements PostgreSQLClient {
  constructor(private readonly poolClient: PoolClient) {}

  async query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<PostgreSQLQueryResult<T>> {
    const result = await this.poolClient.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async transaction<T>(
    callback: (client: PostgreSQLClient) => Promise<T>,
  ): Promise<T> {
    return callback(this);
  }
}

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

  async transaction<T>(
    callback: (client: PostgreSQLClient) => Promise<T>,
  ): Promise<T> {
    const poolClient = await this.pool.connect();
    const transactionClient = new PoolClientPostgreSQLClient(poolClient);

    try {
      await poolClient.query("BEGIN");
      const result = await callback(transactionClient);
      await poolClient.query("COMMIT");
      return result;
    } catch (error) {
      await poolClient.query("ROLLBACK");
      throw error;
    } finally {
      poolClient.release();
    }
  }
}
