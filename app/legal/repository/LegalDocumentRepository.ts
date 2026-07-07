import type { LegalDocument } from "../domain/LegalDocument";

export interface LegalDocumentRepository {
  getById(id: string): Promise<LegalDocument | null>;
  listAll(): Promise<LegalDocument[]>;
}
