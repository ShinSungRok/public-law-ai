import type { PublicDataSource } from "../PublicDataSource";
import type { PublicLegalDataDownloader } from "../PublicLegalDataDownloader";
import type { RawLegalData } from "../RawLegalData";

export class FakePublicLegalDataDownloader implements PublicLegalDataDownloader {
  async download(source: PublicDataSource): Promise<RawLegalData[]> {
    const content = JSON.stringify({
      id: `${source.sourceSystem}-fake-article-1`,
      title: "Fake Statute Article",
      text: "This is fake statute article text for local pipeline verification.",
    });

    return [
      {
        id: `${source.sourceSystem}-fake-raw-1`,
        sourceSystem: source.sourceSystem,
        sourceId: "fake-article-1",
        rawFormat: "json",
        content,
        collectedAt: new Date().toISOString(),
      },
    ];
  }
}
