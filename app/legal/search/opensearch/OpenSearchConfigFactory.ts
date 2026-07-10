import type { OpenSearchConfig } from "./OpenSearchConfig";

const DEFAULT_NODE = "http://localhost:9200";
const DEFAULT_INDEX_NAME = "public-law-ai-local";

function readOptionalEnv(value: string | undefined): string | undefined {
  return value ? value : undefined;
}

export function createOpenSearchConfigFromEnv(): OpenSearchConfig {
  return {
    node: process.env.OPENSEARCH_NODE || DEFAULT_NODE,
    indexName: process.env.OPENSEARCH_INDEX_NAME || DEFAULT_INDEX_NAME,
    username: readOptionalEnv(process.env.OPENSEARCH_USERNAME),
    password: readOptionalEnv(process.env.OPENSEARCH_PASSWORD),
  };
}

export function shouldUseOpenSearchEngine(): boolean {
  return process.env.SEARCH_ENGINE === "opensearch";
}
