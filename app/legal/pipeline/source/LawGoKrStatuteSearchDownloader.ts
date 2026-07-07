import type { HttpClient } from "../http/HttpClient";
import type { PublicDataSource } from "../PublicDataSource";
import type { PublicLegalDataDownloader } from "../PublicLegalDataDownloader";
import type { RawLegalData } from "../RawLegalData";
import type { LawGoKrConfig } from "./LawGoKrConfig";
import { buildLawGoKrStatuteSearchUrl } from "./LawGoKrUrlBuilder";

export class LawGoKrStatuteSearchDownloader implements PublicLegalDataDownloader {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly config: LawGoKrConfig,
    private readonly query: string,
  ) {}

  async download(source: PublicDataSource): Promise<RawLegalData[]> {
    const url = buildLawGoKrStatuteSearchUrl(this.config, this.query);
    const content = await this.httpClient.get(url);

    return [
      {
        id: `${source.sourceSystem}:statute-search:${this.query}`,
        sourceSystem: source.sourceSystem,
        sourceId: `statute-search:${this.query}`,
        rawFormat: "json",
        content,
        collectedAt: new Date().toISOString(),
      },
    ];
  }
}
