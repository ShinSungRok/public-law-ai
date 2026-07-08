import type { LegalDocumentEntity } from "./LegalDocumentEntity";

export interface LegalDocumentRepository {
  save(entity: LegalDocumentEntity): Promise<void>;
  saveAll(entities: LegalDocumentEntity[]): Promise<void>;
  findByDocumentId(documentId: string): Promise<LegalDocumentEntity | null>;
  existsByDocumentId(documentId: string): Promise<boolean>;
}
