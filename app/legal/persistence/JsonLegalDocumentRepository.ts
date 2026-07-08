import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
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

  async findAll(): Promise<LegalDocumentEntity[]> {
    let fileNames: string[];
    try {
      fileNames = await readdir(this.directory);
    } catch {
      return [];
    }

    const entities: LegalDocumentEntity[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) {
        continue;
      }
      const raw = await readFile(
        path.join(this.directory, fileName),
        "utf-8",
      );
      entities.push(JSON.parse(raw) as LegalDocumentEntity);
    }

    return entities;
  }

  private filePathFor(documentId: string): string {
    return path.join(this.directory, `${documentId}.json`);
  }
}
