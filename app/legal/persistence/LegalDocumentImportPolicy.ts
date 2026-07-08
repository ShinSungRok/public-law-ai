import type { LegalDocumentEntity } from "./LegalDocumentEntity";
import type { LegalDocumentImportResult } from "./LegalDocumentImportResult";
import type { LegalDocumentRepository } from "./LegalDocumentRepository";

export interface LegalDocumentImportSelection {
  documentsToSave: LegalDocumentEntity[];
  result: LegalDocumentImportResult;
}

export class LegalDocumentImportPolicy {
  constructor(private readonly repository?: LegalDocumentRepository) {}

  async selectDocumentsToSave(
    entities: LegalDocumentEntity[],
  ): Promise<LegalDocumentImportSelection> {
    if (!this.repository) {
      return {
        documentsToSave: [],
        result: {
          totalCount: entities.length,
          savedCount: 0,
          skippedCount: entities.length,
        },
      };
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

    return {
      documentsToSave,
      result: {
        totalCount: entities.length,
        savedCount: documentsToSave.length,
        skippedCount: entities.length - documentsToSave.length,
      },
    };
  }
}
