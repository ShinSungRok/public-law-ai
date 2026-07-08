import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { LegalDocumentEntity } from "./LegalDocumentEntity";
import type { LegalDocumentRepository } from "./LegalDocumentRepository";

export class JsonLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly directory: string) {}

  async save(entity: LegalDocumentEntity): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(
      this.filePathFor(entity.documentId),
      JSON.stringify(entity, null, 2),
      "utf-8",
    );
  }

  async saveAll(entities: LegalDocumentEntity[]): Promise<void> {
    for (const entity of entities) {
      await this.save(entity);
    }
  }

  async findByDocumentId(
    documentId: string,
  ): Promise<LegalDocumentEntity | null> {
    try {
      const raw = await readFile(this.filePathFor(documentId), "utf-8");
      return JSON.parse(raw) as LegalDocumentEntity;
    } catch {
      return null;
    }
  }

  async existsByDocumentId(documentId: string): Promise<boolean> {
    try {
      await stat(this.filePathFor(documentId));
      return true;
    } catch {
      return false;
    }
  }

  private filePathFor(documentId: string): string {
    return path.join(this.directory, `${documentId}.json`);
  }
}
