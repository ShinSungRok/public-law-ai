import type { ParsedLegalData } from "../ParsedLegalData";
import type { PublicLegalDataParser } from "../PublicLegalDataParser";
import type { RawLegalData } from "../RawLegalData";

interface FakeRawContent {
  id: string;
  title: string;
  text: string;
}

export class FakePublicLegalDataParser implements PublicLegalDataParser {
  async parse(data: RawLegalData): Promise<ParsedLegalData[]> {
    const parsed = JSON.parse(data.content) as FakeRawContent;

    return [
      {
        sourceSystem: data.sourceSystem,
        sourceId: data.sourceId,
        document: {
          id: parsed.id,
          documentType: "STATUTE_ARTICLE",
          title: parsed.title,
          text: parsed.text,
          metadata: {
            sourceSystem: data.sourceSystem,
            sourceId: data.sourceId,
            sourceUrl: "",
            retrievedAt: data.collectedAt,
          },
          sourceRef: {
            sourceType: "statute_article",
            sourceId: data.sourceId,
          },
        },
      },
    ];
  }
}
