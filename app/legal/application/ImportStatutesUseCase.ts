import type { ParsedLegalData } from "../pipeline/ParsedLegalData";
import type { PublicDataSource } from "../pipeline/PublicDataSource";
import type { PublicLegalDataPipeline } from "../pipeline/PublicLegalDataPipeline";

export class ImportStatutesUseCase {
  constructor(private readonly pipeline: PublicLegalDataPipeline) {}

  async execute(source: PublicDataSource): Promise<ParsedLegalData[]> {
    return this.pipeline.run(source);
  }
}
