import type { ParsedLegalData } from "../pipeline/ParsedLegalData";
import type { PublicDataSource } from "../pipeline/PublicDataSource";
import type { PublicLegalDataPipeline } from "../pipeline/PublicLegalDataPipeline";
import type { LegalDocumentRepository } from "../persistence/LegalDocumentRepository";
import { toLegalDocumentEntity } from "../persistence/ParsedLegalDataToEntityMapper";
import type { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";

export class ImportStatutesUseCase {
  constructor(
    private readonly pipeline: PublicLegalDataPipeline,
    private readonly indexer?: OpenSearchLegalDocumentIndexer,
    private readonly repository?: LegalDocumentRepository,
  ) {}

  async execute(source: PublicDataSource): Promise<ParsedLegalData[]> {
    const parsedResults = await this.pipeline.run(source);

    if (this.indexer) {
      for (const parsed of parsedResults) {
        await this.indexer.index(parsed.document);
      }
    }

    if (this.repository) {
      const entities = parsedResults.map(toLegalDocumentEntity);
      await this.repository.saveAll(entities);
    }

    return parsedResults;
  }
}
