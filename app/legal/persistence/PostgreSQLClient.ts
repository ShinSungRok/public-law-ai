export interface PostgreSQLQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface PostgreSQLClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<PostgreSQLQueryResult<T>>;
}
