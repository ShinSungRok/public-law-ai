import { JsonFileCourtCaseRepository } from "./repository/json/JsonFileCourtCaseRepository";
import { JsonFileLegalDocumentRepository } from "./repository/json/JsonFileLegalDocumentRepository";
import { JsonFileStatuteRepository } from "./repository/json/JsonFileStatuteRepository";
import type { LegalDocumentRepository } from "./repository/LegalDocumentRepository";

export function createLegalDocumentRepository(): LegalDocumentRepository {
  const statuteRepository = new JsonFileStatuteRepository();
  const courtCaseRepository = new JsonFileCourtCaseRepository();
  return new JsonFileLegalDocumentRepository(
    statuteRepository,
    courtCaseRepository,
  );
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
