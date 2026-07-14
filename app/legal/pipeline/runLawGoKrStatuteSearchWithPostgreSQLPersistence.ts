import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import type { LegalDocumentRepository } from "../persistence";
import {
  PgPostgreSQLClient,
  PostgreSQLLegalDocumentRepository,
  PostgreSQLLegalDocumentSchemaInitializer,
  assertPostgreSQLConfig,
  createPostgreSQLConfigFromEnv,
} from "../persistence";
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

const DEFAULT_QUERY = "개인정보";
const FAILED_ID_PREVIEW_LIMIT = 10;

export interface LawGoKrPostgreSQLPersistenceDependencies {
  httpClient?: HttpClient;
  repository?: LegalDocumentRepository;
  query?: string;
}

export interface LawGoKrPostgreSQLPersistenceSummary {
  /** Distinct statutes returned by the law.go.kr search stage. */
  statuteCount: number;
  /** Article-level documents produced by the detail stage across successfully processed statutes. */
  parsedArticleCount: number;
  /** Article-level documents persisted to PostgreSQL (via ImportStatutesUseCase, upsert-by-document-id). */
  persistedArticleCount: number;
  /** Statute ids whose detail fetch/parse/persist threw an error. */
  failedStatuteIds: string[];
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

/**
 * Persists article-level LegalDocuments from law.go.kr into PostgreSQL, so
 * PostgreSQL becomes the complete source of truth for OpenSearch reindexing
 * (see runPostgreSQLLegalDocumentReindex.ts). Mirrors the exact search ->
 * dedupe -> per-statute detail-fetch structure and partial-failure handling
 * already established and validated in runLawGoKrOpenSearchIndexing.ts —
 * the only difference is the sink: each statute's detail pipeline
 * (LawGoKrStatuteDetailDownloader/LawGoKrStatuteDetailParser, both
 * unmodified) is persisted via the existing, unmodified ImportStatutesUseCase
 * against a PostgreSQLLegalDocumentRepository instead of being indexed into
 * OpenSearch. No downloader/parser/repository logic is reimplemented here.
 */
export async function runLawGoKrPostgreSQLPersistence(
  dependencies: LawGoKrPostgreSQLPersistenceDependencies = {},
): Promise<LawGoKrPostgreSQLPersistenceSummary> {
  const lawGoKrConfig = createLawGoKrConfigFromEnv();
  const postgresConfig = createPostgreSQLConfigFromEnv();
  const secrets = [lawGoKrConfig.oc, postgresConfig.password];

  try {
    assertLawGoKrConfig(lawGoKrConfig);
  } catch (error) {
    throw stageError("configuration", error, secrets);
  }

  let repository = dependencies.repository;
  if (!repository) {
    try {
      assertPostgreSQLConfig(postgresConfig);
    } catch (error) {
      throw stageError("configuration", error, secrets);
    }
    const client = new PgPostgreSQLClient(postgresConfig);
    await new PostgreSQLLegalDocumentSchemaInitializer(client).initialize();
    repository = new PostgreSQLLegalDocumentRepository(client);
  }

  const query = dependencies.query ?? process.env.LAW_GO_KR_QUERY ?? DEFAULT_QUERY;
  const source = createLawGoKrSource();
  const httpClient = dependencies.httpClient ?? new FetchHttpClient();

  const searchPipeline = new PublicLegalDataPipeline(
    new LawGoKrStatuteSearchDownloader(httpClient, lawGoKrConfig, query),
    new LawGoKrStatuteSearchParser(),
  );

  console.log(`[pipeline:law-go-kr:postgres] Searching statutes for query "${query}"...`);
  let searchResults;
  try {
    searchResults = await searchPipeline.run(source);
  } catch (error) {
    throw stageError("search", error, secrets);
  }

  const statuteIds = dedupeStatuteIds(searchResults.map((parsed) => parsed.document.id));

  if (statuteIds.length === 0) {
    throw new Error(
      `[empty result] law.go.kr query "${query}" produced no statute search results; skipped persistence rather than reporting a false success`,
    );
  }

  console.log(
    `[pipeline:law-go-kr:postgres] Fetching full statute detail and persisting articles for ${statuteIds.length} statute(s)...`,
  );
  const detailParser = new LawGoKrStatuteDetailParser();
  let parsedArticleCount = 0;
  let persistedArticleCount = 0;
  const failedStatuteIds: string[] = [];
  const detailEmptyStatuteIds: string[] = [];

  for (const statuteId of statuteIds) {
    const detailPipeline = new PublicLegalDataPipeline(
      new LawGoKrStatuteDetailDownloader(httpClient, lawGoKrConfig, statuteId),
      detailParser,
    );
    const importStatutesUseCase = new ImportStatutesUseCase(
      detailPipeline,
      undefined,
      repository,
    );

    let parsedResults;
    try {
      parsedResults = await importStatutesUseCase.execute(source);
    } catch (error) {
      console.error(
        `[pipeline:law-go-kr:postgres] Detail fetch/persist failed for statute "${statuteId}": ${redactSecrets(
          error instanceof Error ? error.message : String(error),
          secrets,
        )}`,
      );
      failedStatuteIds.push(statuteId);
      continue;
    }

    if (parsedResults.length === 0) {
      console.warn(
        `[pipeline:law-go-kr:postgres] Statute "${statuteId}" detail response had no usable article content; skipped`,
      );
      detailEmptyStatuteIds.push(statuteId);
      continue;
    }

    parsedArticleCount += parsedResults.length;
    persistedArticleCount += parsedResults.length;
  }

  if (persistedArticleCount === 0) {
    throw new Error(
      `[empty result] law.go.kr query "${query}" produced ${statuteIds.length} statute(s) but no usable full-text articles were persisted; skipped reporting a false success`,
    );
  }

  return {
    statuteCount: statuteIds.length,
    parsedArticleCount,
    persistedArticleCount,
    failedStatuteIds,
    detailEmptyStatuteIds,
  };
}

function printSummary(summary: LawGoKrPostgreSQLPersistenceSummary): void {
  const failedPreview = summary.failedStatuteIds.slice(0, FAILED_ID_PREVIEW_LIMIT);
  console.log("[pipeline:law-go-kr:postgres] Persistence summary:");
  console.log(`  Statutes searched: ${summary.statuteCount}`);
  console.log(`  Parsed article documents: ${summary.parsedArticleCount}`);
  console.log(`  Persisted article documents: ${summary.persistedArticleCount}`);
  if (summary.failedStatuteIds.length > 0) {
    console.log(
      `  Failed statute ids (showing up to ${FAILED_ID_PREVIEW_LIMIT} of ${summary.failedStatuteIds.length}): ${failedPreview.join(", ")}`,
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
    const summary = await runLawGoKrPostgreSQLPersistence();
    printSummary(summary);

    if (summary.persistedArticleCount === 0) {
      console.error("[pipeline:law-go-kr:postgres] No documents were successfully persisted.");
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(
      `[pipeline:law-go-kr:postgres] Failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
