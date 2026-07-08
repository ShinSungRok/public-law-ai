import { randomUUID } from "node:crypto";

import type { ParsedLegalData } from "../pipeline/ParsedLegalData";
import type { PublicDataSource } from "../pipeline/PublicDataSource";
import type { PublicLegalDataPipeline } from "../pipeline/PublicLegalDataPipeline";
import type { ImportHistoryRepository } from "../persistence/ImportHistoryRepository";
import { LegalDocumentImportPolicy } from "../persistence/LegalDocumentImportPolicy";
import type { LegalDocumentRepository } from "../persistence/LegalDocumentRepository";
import { toLegalDocumentEntity } from "../persistence/ParsedLegalDataToEntityMapper";
import type { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";

function deriveQuery(source: PublicDataSource): string {
  const withQuery = source as { query?: unknown };
  return typeof withQuery.query === "string" ? withQuery.query : "";
}

export class ImportStatutesUseCase {
  private readonly importPolicy: LegalDocumentImportPolicy;

  constructor(
    private readonly pipeline: PublicLegalDataPipeline,
    private readonly indexer?: OpenSearchLegalDocumentIndexer,
    private readonly repository?: LegalDocumentRepository,
    private readonly historyRepository?: ImportHistoryRepository,
  ) {
    this.importPolicy = new LegalDocumentImportPolicy(repository);
  }

  async execute(source: PublicDataSource): Promise<ParsedLegalData[]> {
    const startedAt = new Date().toISOString();
    const query = deriveQuery(source);

    try {
      const parsedResults = await this.pipeline.run(source);

      if (this.indexer) {
        for (const parsed of parsedResults) {
          await this.indexer.index(parsed.document);
        }
      }

      let importedCount = parsedResults.length;

      if (this.repository) {
        const entities = parsedResults.map(toLegalDocumentEntity);
        const documentsToSave =
          await this.importPolicy.selectDocumentsToSave(entities);

        await this.repository.saveAll(documentsToSave);
        importedCount = documentsToSave.length;
      }

      if (this.historyRepository) {
        await this.historyRepository.save({
          id: randomUUID(),
          source: source.sourceSystem,
          query,
          importedCount,
          status: "SUCCESS",
          startedAt,
          finishedAt: new Date().toISOString(),
          errorMessage: null,
        });
      }

      return parsedResults;
    } catch (error) {
      if (this.historyRepository) {
        await this.historyRepository.save({
          id: randomUUID(),
          source: source.sourceSystem,
          query,
          importedCount: 0,
          status: "FAILED",
          startedAt,
          finishedAt: new Date().toISOString(),
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }
}
