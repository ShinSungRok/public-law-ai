import { JsonFileCourtCaseRepository } from "./repository/json/JsonFileCourtCaseRepository";
import { JsonFileLegalDocumentRepository } from "./repository/json/JsonFileLegalDocumentRepository";
import { JsonFileStatuteRepository } from "./repository/json/JsonFileStatuteRepository";
import type { LegalDocumentRepository } from "./repository/LegalDocumentRepository";
import { SearchEngineRetriever } from "./retrieval/SearchEngineRetriever";
import type { Retriever } from "./retrieval/Retriever";
import { FakeOpenSearchClient } from "./search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "./search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "./search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "./search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "./search/opensearch/OpenSearchSearchEngine";

export function createLegalDocumentRepository(): LegalDocumentRepository {
  const statuteRepository = new JsonFileStatuteRepository();
  const courtCaseRepository = new JsonFileCourtCaseRepository();
  return new JsonFileLegalDocumentRepository(
    statuteRepository,
    courtCaseRepository,
  );
}

const FAKE_OPEN_SEARCH_CONFIG: OpenSearchConfig = {
  node: "fake://local-opensearch",
  indexName: "legal-documents",
};

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

export function createKeywordRetriever(): Retriever {
  const repository = createLegalDocumentRepository();

  const openSearchClient = new FakeOpenSearchClient();
  const indexManager = new OpenSearchIndexManager(
    openSearchClient,
    FAKE_OPEN_SEARCH_CONFIG,
  );
  const indexer = new OpenSearchLegalDocumentIndexer(
    openSearchClient,
    FAKE_OPEN_SEARCH_CONFIG,
  );
  const searchEngine = new OpenSearchSearchEngine(
    openSearchClient,
    FAKE_OPEN_SEARCH_CONFIG,
  );

  void indexAllDocuments(repository, indexManager, indexer);

  return new SearchEngineRetriever(searchEngine);
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
