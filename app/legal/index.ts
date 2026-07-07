import { JsonFileCourtCaseRepository } from "./repository/json/JsonFileCourtCaseRepository";
import { JsonFileLegalDocumentRepository } from "./repository/json/JsonFileLegalDocumentRepository";
import { JsonFileStatuteRepository } from "./repository/json/JsonFileStatuteRepository";
import type { LegalDocumentRepository } from "./repository/LegalDocumentRepository";
import { KeywordRetriever } from "./retrieval/KeywordRetriever";
import type { Retriever } from "./retrieval/Retriever";

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
  return new KeywordRetriever(repository);
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
