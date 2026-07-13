import type { LegalDocument } from "../domain";
import type { HttpClient } from "./http";
import { FetchHttpClient } from "./http";
import { PublicLegalDataPipeline } from "./index";
import {
  LawGoKrStatuteDetailDownloader,
  LawGoKrStatuteDetailParser,
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
  /** Distinct statutes returned by the law.go.kr search stage. */
  statuteCount: number;
  /** Article-level documents produced by the detail stage and attempted for indexing. */
  totalCount: number;
  indexedCount: number;
  failedCount: number;
  /** Article-level document ids that failed bulk indexing. */
  failedDocumentIds: string[];
  /** Statute ids whose detail fetch/parse threw an error. */
  detailFailedStatuteIds: string[];
  /** Statute ids whose detail response contained no usable article content. */
  detailEmptyStatuteIds: string[];
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

/** Preserves first-seen order while removing duplicate/historical-version repeats. */
function dedupeStatuteIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
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

  const searchPipeline = new PublicLegalDataPipeline(
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

  console.log(`[index:law-go-kr:opensearch] Searching statutes for query "${query}"...`);
  let searchResults;
  try {
    searchResults = await searchPipeline.run(source);
  } catch (error) {
    throw stageError("search", error, secrets);
  }

  const statuteIds = dedupeStatuteIds(searchResults.map((parsed) => parsed.document.id));

  if (statuteIds.length === 0) {
    throw new Error(
      `[empty result] law.go.kr query "${query}" produced no statute search results; skipped indexing rather than reporting a false success`,
    );
  }

  console.log(
    `[index:law-go-kr:opensearch] Fetching full statute detail for ${statuteIds.length} statute(s)...`,
  );
  const detailParser = new LawGoKrStatuteDetailParser();
  const articleDocuments: LegalDocument[] = [];
  const detailFailedStatuteIds: string[] = [];
  const detailEmptyStatuteIds: string[] = [];

  for (const statuteId of statuteIds) {
    const detailPipeline = new PublicLegalDataPipeline(
      new LawGoKrStatuteDetailDownloader(httpClient, lawGoKrConfig, statuteId),
      detailParser,
    );

    let detailResults;
    try {
      detailResults = await detailPipeline.run(source);
    } catch (error) {
      console.error(
        `[index:law-go-kr:opensearch] Detail fetch failed for statute "${statuteId}": ${redactSecrets(
          error instanceof Error ? error.message : String(error),
          secrets,
        )}`,
      );
      detailFailedStatuteIds.push(statuteId);
      continue;
    }

    if (detailResults.length === 0) {
      console.warn(
        `[index:law-go-kr:opensearch] Statute "${statuteId}" detail response had no usable article content; skipped`,
      );
      detailEmptyStatuteIds.push(statuteId);
      continue;
    }

    articleDocuments.push(...detailResults.map((parsed) => parsed.document));
  }

  if (articleDocuments.length === 0) {
    throw new Error(
      `[empty result] law.go.kr query "${query}" produced ${statuteIds.length} statute(s) but no usable full-text articles; skipped indexing rather than reporting a false success`,
    );
  }

  console.log(
    `[index:law-go-kr:opensearch] Indexing ${articleDocuments.length} article document(s) into "${openSearchConfig.indexName}"...`,
  );
  let result;
  try {
    result = await indexer.indexAll(articleDocuments, {
      batchSize: BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    });
  } catch (error) {
    throw stageError("bulk indexing", error, secrets);
  }

  return {
    targetIndex: openSearchConfig.indexName,
    statuteCount: statuteIds.length,
    totalCount: result.totalCount,
    indexedCount: result.indexedCount,
    failedCount: result.failedCount,
    failedDocumentIds: result.failedDocumentIds,
    detailFailedStatuteIds,
    detailEmptyStatuteIds,
  };
}

function printSummary(summary: LawGoKrOpenSearchIndexingSummary): void {
  const failedPreview = summary.failedDocumentIds.slice(0, FAILED_ID_PREVIEW_LIMIT);
  console.log("[index:law-go-kr:opensearch] Indexing summary:");
  console.log(`  Target index: ${summary.targetIndex}`);
  console.log(`  Statutes searched: ${summary.statuteCount}`);
  console.log(`  Article documents: ${summary.totalCount}`);
  console.log(`  Indexed: ${summary.indexedCount}`);
  console.log(`  Failed (bulk indexing): ${summary.failedCount}`);
  if (summary.failedCount > 0) {
    console.log(
      `  Failed document ids (showing up to ${FAILED_ID_PREVIEW_LIMIT} of ${summary.failedCount}): ${failedPreview.join(", ")}`,
    );
  }
  if (summary.detailFailedStatuteIds.length > 0) {
    console.log(
      `  Statutes with failed detail fetch: ${summary.detailFailedStatuteIds.join(", ")}`,
    );
  }
  if (summary.detailEmptyStatuteIds.length > 0) {
    console.log(
      `  Statutes with no usable article content: ${summary.detailEmptyStatuteIds.join(", ")}`,
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
