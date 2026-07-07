import { JsonFileCourtCaseRepository } from "./repository/json/JsonFileCourtCaseRepository";
import { JsonFileLegalDocumentRepository } from "./repository/json/JsonFileLegalDocumentRepository";
import { JsonFileStatuteRepository } from "./repository/json/JsonFileStatuteRepository";
import type { LegalDocumentRepository } from "./repository/LegalDocumentRepository";
import { SearchEngineRetriever } from "./retrieval/SearchEngineRetriever";
import type { RetrievalResult } from "./retrieval/RetrievalResult";
import type { Retriever } from "./retrieval/Retriever";
import { FakeOpenSearchClient } from "./search/opensearch/FakeOpenSearchClient";
import type { OpenSearchClient } from "./search/opensearch/OpenSearchClient";
import type { OpenSearchConfig } from "./search/opensearch/OpenSearchConfig";
import { createOpenSearchConfigFromEnv } from "./search/opensearch/OpenSearchConfigFactory";
import { OpenSearchIndexManager } from "./search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "./search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSdkClient } from "./search/opensearch/OpenSearchSdkClient";
import { OpenSearchSearchEngine } from "./search/opensearch/OpenSearchSearchEngine";

export function createLegalDocumentRepository(): LegalDocumentRepository {
  const statuteRepository = new JsonFileStatuteRepository();
  const courtCaseRepository = new JsonFileCourtCaseRepository();
  return new JsonFileLegalDocumentRepository(
    statuteRepository,
    courtCaseRepository,
  );
}

function createOpenSearchClient(config: OpenSearchConfig): OpenSearchClient {
  return process.env.OPENSEARCH_MODE === "sdk"
    ? new OpenSearchSdkClient(config)
    : new FakeOpenSearchClient();
}

async function indexAllDocuments(
  repository: LegalDocumentRepository,
  indexManager: OpenSearchIndexManager,
  indexer: OpenSearchLegalDocumentIndexer,
): Promise<void> {
  await indexManager.ensureLegalIndex();
  const documents = await repository.listAll();
  for (const document of documents) {
    await indexer.index(document);
  }
}

class ReadyOnceRetriever implements Retriever {
  constructor(
    private readonly ready: Promise<void>,
    private readonly retriever: Retriever,
  ) {}

  async retrieve(query: string): Promise<RetrievalResult> {
    await this.ready;
    return this.retriever.retrieve(query);
  }
}

export function createKeywordRetriever(): Retriever {
  const repository = createLegalDocumentRepository();

  const openSearchConfig = createOpenSearchConfigFromEnv();
  const openSearchClient = createOpenSearchClient(openSearchConfig);
  const indexManager = new OpenSearchIndexManager(
    openSearchClient,
    openSearchConfig,
  );
  const indexer = new OpenSearchLegalDocumentIndexer(
    openSearchClient,
    openSearchConfig,
  );
  const searchEngine = new OpenSearchSearchEngine(
    openSearchClient,
    openSearchConfig,
  );

  const ready = indexAllDocuments(repository, indexManager, indexer);
  const retriever = new SearchEngineRetriever(searchEngine);

  return new ReadyOnceRetriever(ready, retriever);
}

export type {
  Citation,
  CourtCaseDocument,
  LegalDocument,
  LegalDocumentSourceRef,
  LegalDocumentType,
  LegalSourceMetadata,
  LegalSourceRefType,
  StatuteArticle,
  StatuteArticleParagraph,
  StatuteDocument,
  StatuteStatus,
} from "./domain";
export type {
  CourtCaseRepository,
  LegalDocumentRepository,
  StatuteRepository,
} from "./repository";
export type { RetrievalResult, RetrievedDocument } from "./retrieval/RetrievalResult";
export type { Retriever } from "./retrieval/Retriever";
export {
  buildCitation,
  buildCitationsFromRetrievedDocuments,
} from "./citation/CitationBuilder";
export type { ContextDocument } from "./context/ContextDocument";
export type { PromptContext } from "./context/PromptContext";
export { buildPromptContext } from "./context/PromptContextBuilder";
export { buildLegalPromptRequest } from "./prompt/LegalPromptBuilder";
export type { RetrievalTestCase } from "./evaluation/RetrievalTestCase";
export type { EvaluationResult } from "./evaluation/EvaluationResult";
export { RetrievalEvaluator } from "./evaluation/RetrievalEvaluator";
