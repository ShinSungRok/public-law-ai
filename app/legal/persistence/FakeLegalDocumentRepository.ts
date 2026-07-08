import type { LegalDocumentEntity } from "./LegalDocumentEntity";
import type { LegalDocumentRepository } from "./LegalDocumentRepository";

export class FakeLegalDocumentRepository implements LegalDocumentRepository {
  private readonly entitiesByDocumentId = new Map<string, LegalDocumentEntity>();

  async save(entity: LegalDocumentEntity): Promise<void> {
    this.entitiesByDocumentId.set(entity.documentId, entity);
  }

  async saveAll(entities: LegalDocumentEntity[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<LegalDocumentEntity | null> {
    return this.entitiesByDocumentId.get(documentId) ?? null;
  }

  async existsByDocumentId(documentId: string): Promise<boolean> {
    return this.entitiesByDocumentId.has(documentId);
  }
}
