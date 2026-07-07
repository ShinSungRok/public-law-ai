import type { ParsedLegalData } from "./ParsedLegalData";
import type { PublicDataSource } from "./PublicDataSource";
import type { PublicLegalDataDownloader } from "./PublicLegalDataDownloader";
import type { PublicLegalDataParser } from "./PublicLegalDataParser";

export class PublicLegalDataPipeline {
  constructor(
    private readonly downloader: PublicLegalDataDownloader,
    private readonly parser: PublicLegalDataParser,
  ) {}

  async run(source: PublicDataSource): Promise<ParsedLegalData[]> {
    const rawData = await this.downloader.download(source);
    const parsed = await Promise.all(
      rawData.map((data) => this.parser.parse(data)),
    );
    return parsed.flat();
  }
}
