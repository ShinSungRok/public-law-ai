import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { Retriever } from "../retrieval/Retriever";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import type { OpenSearchSearchResponse } from "../search/opensearch/OpenSearchSearchResponse";
import { toSearchResults } from "../search/opensearch/OpenSearchSearchResponseMapper";
import type { SearchEngine } from "../search/SearchEngine";
import type { SearchHit } from "../search/SearchHit";
import type { SearchQuery } from "../search/SearchQuery";
import { RAG_EVALUATION_DATASET } from "./RagEvaluationDataset";
import { REAL_ARTICLE_DOCUMENTS } from "./RealArticleFixtures";
import { analyzeRetrievalFailures } from "./RetrievalFailureAnalyzer";
import { buildRetrievalFailureReport, formatRetrievalFailureReport } from "./RetrievalFailureReport";
import { RetrievalMetricsEvaluationRunner } from "./RetrievalMetricsEvaluationRunner";
import { buildRetrievalMetricsReport, formatRetrievalMetricsReport } from "./RetrievalMetricsReport";

const INDEX_NAME = "public-law-ai-bm25-optimization-validation";
const EPSILON = 1e-9;
const LEGACY_DEFAULT_SIZE = 10;

/**
 * The pre-Phase-26 multi_match shape (plain fields, no boost, no
 * tie_breaker, no minimum_should_match) — reconstructed here only as a
 * measurement baseline. Production code now builds its query via
 * buildOpenSearchKeywordSearchBody (OpenSearchSearchBodyBuilder.ts); this
 * function is never imported by it.
 */
function buildLegacyMultiMatchSearchBody(query: SearchQuery): unknown {
  return {
    size: query.limit ?? LEGACY_DEFAULT_SIZE,
    query: {
      multi_match: {
        query: query.text,
        fields: ["title", "text"],
      },
    },
  };
}

/**
 * Mirrors OpenSearchSearchEngine.search() exactly, substituting the legacy
 * query body — isolates "which query shape was used" as the only variable
 * between the baseline and optimized runs below, while still going through
 * the real OpenSearchClient and the real, unmodified toSearchResults mapper.
 */
class LegacyMultiMatchSearchEngine implements SearchEngine {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async search(query: SearchQuery): Promise<SearchHit[]> {
    const body = buildLegacyMultiMatchSearchBody(query);
    const response = await this.client.search(this.config.indexName, body);
    return toSearchResults(response as OpenSearchSearchResponse);
  }
}

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function buildIndexedClient(): Promise<{
  client: FakeOpenSearchClient;
  config: OpenSearchConfig;
}> {
  const client = new FakeOpenSearchClient();
  const config: OpenSearchConfig = {
    node: "http://fake-opensearch:9200",
    indexName: INDEX_NAME,
  };

  await new OpenSearchIndexManager(client, config).ensureLegalIndex();
  await new OpenSearchLegalDocumentIndexer(client, config).indexAll(REAL_ARTICLE_DOCUMENTS);

  return { client, config };
}

async function main(): Promise<void> {
  console.log(
    "[evaluation] No external services required: OpenSearch is replaced with FakeOpenSearchClient. " +
      "The fake now honors field boosts, tie_breaker, and minimum_should_match from the query body " +
      "(previously a flat title/text substring scorer) so a BM25 query-shape change actually moves its metrics.",
  );

  const { client, config } = await buildIndexedClient();

  const legacyRetriever: Retriever = new SearchEngineRetriever(
    new LegacyMultiMatchSearchEngine(client, config),
  );
  // OpenSearchSearchEngine + buildOpenSearchKeywordSearchBody: the real,
  // unmodified production retrieval path (Retriever/SearchEngine interfaces
  // and SearchEngineRetriever are all reused as-is).
  const optimizedRetriever: Retriever = new SearchEngineRetriever(
    new OpenSearchSearchEngine(client, config),
  );

  console.log(
    "[evaluation] Running RAG_EVALUATION_DATASET retrieval metrics through the pre-optimization query shape (baseline)...",
  );
  const legacySummary = await new RetrievalMetricsEvaluationRunner(legacyRetriever).runMany(
    RAG_EVALUATION_DATASET,
  );
  const legacyReport = buildRetrievalMetricsReport(RAG_EVALUATION_DATASET, legacySummary.results);

  console.log(
    "[evaluation] Running RAG_EVALUATION_DATASET retrieval metrics through the optimized BM25 query (current production shape)...",
  );
  const optimizedSummary = await new RetrievalMetricsEvaluationRunner(optimizedRetriever).runMany(
    RAG_EVALUATION_DATASET,
  );
  const optimizedReport = buildRetrievalMetricsReport(RAG_EVALUATION_DATASET, optimizedSummary.results);

  console.log("== Baseline (pre-optimization multi_match: unboosted fields, best_fields default) ==");
  console.log(formatRetrievalMetricsReport(legacyReport));
  console.log("== Optimized (title^2 boost + best_fields tie_breaker=0.3) ==");
  console.log(formatRetrievalMetricsReport(optimizedReport));

  assertTruthy(
    optimizedReport.hitRate >= legacyReport.hitRate - EPSILON,
    "expected the optimized query not to regress hit rate versus the baseline",
  );
  assertTruthy(
    optimizedReport.recallAt5 >= legacyReport.recallAt5 - EPSILON,
    "expected the optimized query not to regress recall@5 versus the baseline",
  );
  assertTruthy(
    optimizedReport.mrr >= legacyReport.mrr - EPSILON,
    "expected the optimized query not to regress MRR versus the baseline",
  );
  assertTruthy(
    optimizedReport.mrr > legacyReport.mrr + EPSILON ||
      optimizedReport.recallAt1 > legacyReport.recallAt1 + EPSILON ||
      optimizedReport.hitRate > legacyReport.hitRate + EPSILON,
    "expected the optimized BM25 query to strictly improve at least one retrieval metric over the baseline",
  );

  console.log(
    "[evaluation] Comparing retrieval failure categories (RetrievalFailureAnalyzer, unmodified) before/after...",
  );
  const repository = new InMemoryLegalDocumentRepository(REAL_ARTICLE_DOCUMENTS);
  const legacyAnalyses = await analyzeRetrievalFailures(RAG_EVALUATION_DATASET, legacyRetriever, repository);
  const optimizedAnalyses = await analyzeRetrievalFailures(
    RAG_EVALUATION_DATASET,
    optimizedRetriever,
    repository,
  );
  const legacyFailureReport = buildRetrievalFailureReport(legacyAnalyses);
  const optimizedFailureReport = buildRetrievalFailureReport(optimizedAnalyses);

  console.log("== Baseline failure report ==");
  console.log(formatRetrievalFailureReport(legacyFailureReport));
  console.log("== Optimized failure report ==");
  console.log(formatRetrievalFailureReport(optimizedFailureReport));

  assertTruthy(
    optimizedFailureReport.failureCount <= legacyFailureReport.failureCount,
    "expected the optimized BM25 query not to increase total retrieval failures",
  );

  console.log("OpenSearch BM25 optimization validation succeeded.");
}

main();
