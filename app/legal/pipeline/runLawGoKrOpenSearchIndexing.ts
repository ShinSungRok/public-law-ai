import type { HttpClient } from "./http";
import { FetchHttpClient } from "./http";
import { PublicLegalDataPipeline } from "./index";
import {
  LawGoKrStatuteSearchDownloader,
  LawGoKrStatuteSearchParser,
  assertLawGoKrConfig,
  createLawGoKrConfigFromEnv,
  createLawGoKrSource,
} from "./source";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import { createOpenSearchConfigFromEnv } from "../search/opensearch/OpenSearchConfigFactory";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSdkClient } from "../search/opensearch/OpenSearchSdkClient";

const DEFAULT_QUERY = "개인정보";
const BATCH_SIZE = 100;
const MAX_RETRIES = 2;
const FAILED_ID_PREVIEW_LIMIT = 10;

export interface LawGoKrOpenSearchIndexingDependencies {
  httpClient?: HttpClient;
  openSearchClient?: OpenSearchClient;
  query?: string;
}

export interface LawGoKrOpenSearchIndexingSummary {
  targetIndex: string;
  totalCount: number;
  indexedCount: number;
  failedCount: number;
  failedDocumentIds: string[];
}

function redactSecrets(message: string, secrets: Array<string | undefined>): string {
  let redacted = message;
  for (const secret of secrets) {
    if (secret) {
      redacted = redacted.split(secret).join("[REDACTED]");
    }
  }
  return redacted;
}

function stageError(
  stage: string,
  error: unknown,
  secrets: Array<string | undefined>,
): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  return new Error(`[${stage}] ${redactSecrets(rawMessage, secrets)}`);
}

export async function runLawGoKrOpenSearchIndexing(
  dependencies: LawGoKrOpenSearchIndexingDependencies = {},
): Promise<LawGoKrOpenSearchIndexingSummary> {
  const lawGoKrConfig = createLawGoKrConfigFromEnv();
  const openSearchConfig = createOpenSearchConfigFromEnv();
  const secrets = [lawGoKrConfig.oc, openSearchConfig.password];

  try {
    assertLawGoKrConfig(lawGoKrConfig);
  } catch (error) {
    throw stageError("configuration", error, secrets);
  }

  const query = dependencies.query ?? process.env.LAW_GO_KR_QUERY ?? DEFAULT_QUERY;
  const source = createLawGoKrSource();
  const httpClient = dependencies.httpClient ?? new FetchHttpClient();
  const pipeline = new PublicLegalDataPipeline(
    new LawGoKrStatuteSearchDownloader(httpClient, lawGoKrConfig, query),
    new LawGoKrStatuteSearchParser(),
  );

  const openSearchClient =
    dependencies.openSearchClient ?? new OpenSearchSdkClient(openSearchConfig);
  const indexManager = new OpenSearchIndexManager(openSearchClient, openSearchConfig);
  const indexer = new OpenSearchLegalDocumentIndexer(openSearchClient, openSearchConfig);

  console.log(
    `[index:law-go-kr:opensearch] Ensuring index "${openSearchConfig.indexName}" exists...`,
  );
  try {
    await indexManager.ensureLegalIndex();
  } catch (error) {
    throw stageError("index setup", error, secrets);
  }

  console.log(`[index:law-go-kr:opensearch] Downloading and parsing query "${query}"...`);
  let parsedResults;
  try {
    parsedResults = await pipeline.run(source);
  } catch (error) {
    throw stageError("download/parse", error, secrets);
  }

  const documents = parsedResults.map((parsed) => parsed.document);

  if (documents.length === 0) {
    throw new Error(
      `[empty result] law.go.kr query "${query}" produced no legal documents; skipped indexing rather than reporting a false success`,
    );
  }

  console.log(
    `[index:law-go-kr:opensearch] Indexing ${documents.length} document(s) into "${openSearchConfig.indexName}"...`,
  );
  let result;
  try {
    result = await indexer.indexAll(documents, {
      batchSize: BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    });
  } catch (error) {
    throw stageError("bulk indexing", error, secrets);
  }

  return {
    targetIndex: openSearchConfig.indexName,
    totalCount: result.totalCount,
    indexedCount: result.indexedCount,
    failedCount: result.failedCount,
    failedDocumentIds: result.failedDocumentIds,
  };
}

function printSummary(summary: LawGoKrOpenSearchIndexingSummary): void {
  const failedPreview = summary.failedDocumentIds.slice(0, FAILED_ID_PREVIEW_LIMIT);
  console.log("[index:law-go-kr:opensearch] Indexing summary:");
  console.log(`  Target index: ${summary.targetIndex}`);
  console.log(`  Total: ${summary.totalCount}`);
  console.log(`  Indexed: ${summary.indexedCount}`);
  console.log(`  Failed: ${summary.failedCount}`);
  if (summary.failedCount > 0) {
    console.log(
      `  Failed document ids (showing up to ${FAILED_ID_PREVIEW_LIMIT} of ${summary.failedCount}): ${failedPreview.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  try {
    const summary = await runLawGoKrOpenSearchIndexing();
    printSummary(summary);

    if (summary.indexedCount === 0) {
      console.error(
        "[index:law-go-kr:opensearch] No documents were successfully indexed.",
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `[index:law-go-kr:opensearch] Failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
