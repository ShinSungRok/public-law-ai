import type { LegalDocumentEntity } from "./LegalDocumentEntity";
import type { LegalDocumentRepository } from "./LegalDocumentRepository";

export class LegalDocumentImportPolicy {
  constructor(private readonly repository?: LegalDocumentRepository) {}

  async selectDocumentsToSave(
    entities: LegalDocumentEntity[],
  ): Promise<LegalDocumentEntity[]> {
    if (!this.repository) {
      return [];
    }

    const documentsToSave: LegalDocumentEntity[] = [];
    for (const entity of entities) {
      const alreadyExists = await this.repository.existsByDocumentId(
        entity.documentId,
      );
      if (!alreadyExists) {
        documentsToSave.push(entity);
      }
    }

    return documentsToSave;
  }
}
