import type { ParsedLegalData } from "../pipeline/ParsedLegalData";
import type { PublicDataSource } from "../pipeline/PublicDataSource";
import type { PublicLegalDataPipeline } from "../pipeline/PublicLegalDataPipeline";
import type { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";

export class ImportStatutesUseCase {
  constructor(
    private readonly pipeline: PublicLegalDataPipeline,
    private readonly indexer?: OpenSearchLegalDocumentIndexer,
  ) {}

  async execute(source: PublicDataSource): Promise<ParsedLegalData[]> {
    const parsedResults = await this.pipeline.run(source);

    if (this.indexer) {
      for (const parsed of parsedResults) {
        await this.indexer.index(parsed.document);
      }
    }

    return parsedResults;
  }
}
