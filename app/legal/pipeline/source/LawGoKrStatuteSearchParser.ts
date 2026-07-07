import type { LegalDocument } from "../../domain";
import type { ParsedLegalData } from "../ParsedLegalData";
import type { PublicLegalDataParser } from "../PublicLegalDataParser";
import type { RawLegalData } from "../RawLegalData";

interface LawGoKrStatuteSearchItem {
  법령ID?: unknown;
  법령일련번호?: unknown;
  법령명한글?: unknown;
  법령구분명?: unknown;
  소관부처명?: unknown;
  공포일자?: unknown;
  시행일자?: unknown;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toItemArray(value: unknown): LawGoKrStatuteSearchItem[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord) as LawGoKrStatuteSearchItem[];
  }

  if (isRecord(value)) {
    return [value as LawGoKrStatuteSearchItem];
  }

  return [];
}

function extractItems(parsed: unknown): LawGoKrStatuteSearchItem[] {
  if (!isRecord(parsed)) {
    return [];
  }

  const lawSearch = parsed["LawSearch"];
  if (!isRecord(lawSearch)) {
    return [];
  }

  return toItemArray(lawSearch["law"]);
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return undefined;
}

function buildText(title: string | undefined, item: LawGoKrStatuteSearchItem): string {
  const parts: string[] = [];

  if (title) {
    parts.push(title);
  }

  const lawType = toNonEmptyString(item["법령구분명"]);
  if (lawType) {
    parts.push(lawType);
  }

  const ministry = toNonEmptyString(item["소관부처명"]);
  if (ministry) {
    parts.push(ministry);
  }

  const proclamationDate = toNonEmptyString(item["공포일자"]);
  if (proclamationDate) {
    parts.push(proclamationDate);
  }

  const enforcementDate = toNonEmptyString(item["시행일자"]);
  if (enforcementDate) {
    parts.push(enforcementDate);
  }

  return parts.join(" ");
}

export class LawGoKrStatuteSearchParser implements PublicLegalDataParser {
  async parse(data: RawLegalData): Promise<ParsedLegalData[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.content);
    } catch {
      return [];
    }

    const items = extractItems(parsed);

    return items.map((item) => {
      const lawId = toNonEmptyString(item["법령ID"]) ?? toNonEmptyString(item["법령일련번호"]);
      const documentId = lawId ?? data.sourceId;
      const title = toNonEmptyString(item["법령명한글"]);

      const document: LegalDocument = {
        id: documentId,
        documentType: "STATUTE_ARTICLE",
        title: title ?? "",
        text: buildText(title, item),
        metadata: {
          sourceSystem: data.sourceSystem,
          sourceId: lawId ?? data.sourceId,
          sourceUrl: "",
          retrievedAt: data.collectedAt,
        },
        sourceRef: {
          sourceType: "statute_article",
          sourceId: documentId,
        },
      };

      return {
        sourceSystem: data.sourceSystem,
        sourceId: data.sourceId,
        document,
      };
    });
  }
}
