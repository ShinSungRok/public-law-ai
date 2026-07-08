import type { PostgreSQLConfig } from "./PostgreSQLConfig";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 5432;

function readBooleanEnv(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

export function createPostgreSQLConfigFromEnv(): PostgreSQLConfig {
  return {
    host: process.env.POSTGRES_HOST || DEFAULT_HOST,
    port: process.env.POSTGRES_PORT
      ? Number(process.env.POSTGRES_PORT)
      : DEFAULT_PORT,
    database: process.env.POSTGRES_DATABASE || "",
    user: process.env.POSTGRES_USER || "",
    password: process.env.POSTGRES_PASSWORD || "",
    ssl: readBooleanEnv(process.env.POSTGRES_SSL),
  };
}

export function assertPostgreSQLConfig(config: PostgreSQLConfig): void {
  const missing: string[] = [];

  if (!config.host) missing.push("POSTGRES_HOST");
  if (!config.port) missing.push("POSTGRES_PORT");
  if (!config.database) missing.push("POSTGRES_DATABASE");
  if (!config.user) missing.push("POSTGRES_USER");
  if (!config.password) missing.push("POSTGRES_PASSWORD");

  if (missing.length > 0) {
    throw new Error(
      `Missing required PostgreSQL configuration: ${missing.join(", ")}`,
    );
  }
}
