import type { HttpClient } from "../http/HttpClient";
import type { PublicDataSource } from "../PublicDataSource";
import type { PublicLegalDataDownloader } from "../PublicLegalDataDownloader";
import type { RawLegalData } from "../RawLegalData";
import type { LawGoKrConfig } from "./LawGoKrConfig";
import { buildLawGoKrStatuteDetailUrl } from "./LawGoKrUrlBuilder";

export class LawGoKrStatuteDetailDownloader implements PublicLegalDataDownloader {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly config: LawGoKrConfig,
    private readonly statuteId: string,
  ) {}

  async download(source: PublicDataSource): Promise<RawLegalData[]> {
    const url = buildLawGoKrStatuteDetailUrl(this.config, this.statuteId);
    const content = await this.httpClient.get(url);

    return [
      {
        id: `${source.sourceSystem}:statute-detail:${this.statuteId}`,
        sourceSystem: source.sourceSystem,
        sourceId: this.statuteId,
        rawFormat: "json",
        content,
        collectedAt: new Date().toISOString(),
      },
    ];
  }
}
