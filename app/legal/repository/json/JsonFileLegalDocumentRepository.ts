import type { LegalDocument } from "../../domain/LegalDocument";
import {
  courtCaseToLegalDocument,
  statuteArticleToLegalDocument,
} from "../../mapper";
import type { CourtCaseRepository } from "../CourtCaseRepository";
import type { LegalDocumentRepository } from "../LegalDocumentRepository";
import type { StatuteRepository } from "../StatuteRepository";

export class JsonFileLegalDocumentRepository
  implements LegalDocumentRepository
{
  constructor(
    private readonly statuteRepository: StatuteRepository,
    private readonly courtCaseRepository: CourtCaseRepository,
  ) {}

  async listAll(): Promise<LegalDocument[]> {
    const [articles, cases] = await Promise.all([
      this.statuteRepository.listArticles(),
      this.courtCaseRepository.listCases(),
    ]);

    return [
      ...articles.map(statuteArticleToLegalDocument),
      ...cases.map(courtCaseToLegalDocument),
    ];
  }

  async getById(id: string): Promise<LegalDocument | null> {
    const documents = await this.listAll();
    return documents.find((document) => document.id === id) ?? null;
  }
}
