import { JsonFileCourtCaseRepository } from "./repository/json/JsonFileCourtCaseRepository";
import { JsonFileLegalDocumentRepository } from "./repository/json/JsonFileLegalDocumentRepository";
import { JsonFileStatuteRepository } from "./repository/json/JsonFileStatuteRepository";
import type { LegalDocumentRepository } from "./repository/LegalDocumentRepository";
import { KeywordRetriever } from "./retrieval/KeywordRetriever";
import { SearchEngineRetriever } from "./retrieval/SearchEngineRetriever";
import type { Retriever } from "./retrieval/Retriever";
import { KeywordSearchEngine } from "./search/KeywordSearchEngine";

export function createLegalDocumentRepository(): LegalDocumentRepository {
  const statuteRepository = new JsonFileStatuteRepository();
  const courtCaseRepository = new JsonFileCourtCaseRepository();
  return new JsonFileLegalDocumentRepository(
    statuteRepository,
    courtCaseRepository,
  );
}

export function createKeywordRetriever(): Retriever {
  const repository = createLegalDocumentRepository();
  const keywordRetriever = new KeywordRetriever(repository);
  const searchEngine = new KeywordSearchEngine(keywordRetriever);
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
