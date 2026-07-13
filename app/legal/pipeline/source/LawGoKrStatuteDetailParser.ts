import type { LegalDocument } from "../../domain";
import type { ParsedLegalData } from "../ParsedLegalData";
import type { PublicLegalDataParser } from "../PublicLegalDataParser";
import type { RawLegalData } from "../RawLegalData";
import { buildLawGoKrStatuteDetailViewUrl } from "./LawGoKrUrlBuilder";

const DEFAULT_BASE_URL = "https://www.law.go.kr";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toItemArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    return [value];
  }
  return [];
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/** law.go.kr often nests a single scalar under `{ content: ... }`. */
function toDisplayString(value: unknown): string | undefined {
  if (isRecord(value)) {
    return toNonEmptyString(value["content"]);
  }
  return toNonEmptyString(value);
}

function normalizeNumeric(value: unknown): string {
  const raw = toNonEmptyString(value);
  if (!raw) {
    return "";
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? raw : String(parsed);
}

function padJoSegment(value: string, length: number): string {
  const digits = value.replace(/\D/g, "") || "0";
  return digits.padStart(length, "0").slice(-length);
}

// law.go.kr's 조문단위 array interleaves 편/장/절/관 (Part/Chapter/Section/
// Subsection) heading pseudo-entries alongside real articles, and a heading
// entry shares 조문번호/조문가지번호 with the real article that follows it
// (e.g. a "제4장 ..." heading and the real 제29조 both report 조문번호="29").
// That collision on the same `<statuteId>:<articleNo>` id is what let a
// heading silently take the place of the real article. Headings carry no
// 조문제목 and no 항 substructure — only a chapter/section title as their
// 조문내용 — so they are detected structurally and skipped entirely: they
// are not meaningful standalone RAG documents.
const HEADING_CONTENT_PATTERN = /^제\s*\d+\s*(편|장|절|관)\b/;

function looksLikeStructuralHeading(
  articleContent: string | undefined,
  articleTitle: string | undefined,
  paragraphCount: number,
): boolean {
  if (articleTitle || paragraphCount > 0 || !articleContent) {
    return false;
  }
  return HEADING_CONTENT_PATTERN.test(articleContent.trim());
}

function contentRichness(
  articleContent: string | undefined,
  paragraphLines: string[],
): number {
  const paragraphScore = paragraphLines.length > 0 ? 1 : 0;
  return paragraphScore * 2 + (articleContent?.length ?? 0) / 10_000;
}

function findStatuteRoot(parsed: unknown): Record<string, unknown> {
  if (!isRecord(parsed)) {
    return {};
  }
  const nested = parsed["법령"];
  return isRecord(nested) ? nested : parsed;
}

function findBasicInfo(root: Record<string, unknown>): Record<string, unknown> {
  const basicInfo = root["기본정보"];
  return isRecord(basicInfo) ? basicInfo : root;
}

function findArticleItems(root: Record<string, unknown>): Record<string, unknown>[] {
  const articlesSection = root["조문"];
  if (isRecord(articlesSection) && "조문단위" in articlesSection) {
    return toItemArray(articlesSection["조문단위"]);
  }
  return toItemArray(articlesSection);
}

function extractStatuteTitle(basicInfo: Record<string, unknown>): string {
  return (
    toDisplayString(basicInfo["법령명_한글"]) ??
    toDisplayString(basicInfo["법령명한글"]) ??
    toDisplayString(basicInfo["법령명"]) ??
    ""
  );
}

function flattenParagraphs(paragraphs: Record<string, unknown>[]): string[] {
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const paragraphText = toNonEmptyString(paragraph["항내용"]);
    if (paragraphText) {
      lines.push(normalizeWhitespace(paragraphText));
    }

    for (const item of toItemArray(paragraph["호"])) {
      const itemText = toNonEmptyString(item["호내용"]);
      if (itemText) {
        lines.push(normalizeWhitespace(itemText));
      }

      for (const subItem of toItemArray(item["목"])) {
        const subItemText = toNonEmptyString(subItem["목내용"]);
        if (subItemText) {
          lines.push(normalizeWhitespace(subItemText));
        }
      }
    }
  }

  return lines;
}

interface ParsedArticleIdentity {
  articleNo: string;
  articleBranchNo: string;
  /** e.g. "2" or "15-2" — used both for the stable document id and display. */
  display: string;
  jo: string;
}

function resolveArticleIdentity(item: Record<string, unknown>): ParsedArticleIdentity | undefined {
  const articleNo = normalizeNumeric(item["조문번호"]);
  if (!articleNo) {
    return undefined;
  }
  const articleBranchNo = normalizeNumeric(item["조문가지번호"]);
  const hasBranch = articleBranchNo && articleBranchNo !== "0";
  const display = hasBranch ? `${articleNo}-${articleBranchNo}` : articleNo;
  const jo = `${padJoSegment(articleNo, 4)}${padJoSegment(articleBranchNo || "0", 2)}`;

  return { articleNo, articleBranchNo, display, jo };
}

function buildArticleText(params: {
  statuteTitle: string;
  articleDisplay: string;
  articleTitle: string | undefined;
  promulgationDate: string | undefined;
  enforcementDate: string | undefined;
  articleContent: string | undefined;
  paragraphLines: string[];
}): string {
  const headerLines: string[] = [];
  if (params.statuteTitle) {
    headerLines.push(`법령명: ${params.statuteTitle}`);
  }
  headerLines.push(`조문: 제${params.articleDisplay}조`);
  if (params.articleTitle) {
    headerLines.push(`조문 제목: ${params.articleTitle}`);
  }
  if (params.promulgationDate) {
    headerLines.push(`공포일자: ${params.promulgationDate}`);
  }
  if (params.enforcementDate) {
    headerLines.push(`시행일자: ${params.enforcementDate}`);
  }

  const bodyLines: string[] = [];
  if (params.articleContent) {
    bodyLines.push(normalizeWhitespace(params.articleContent));
  }
  bodyLines.push(...params.paragraphLines);

  return [headerLines.join("\n"), bodyLines.join("\n")].filter((part) => part.length > 0).join("\n\n");
}

export class LawGoKrStatuteDetailParser implements PublicLegalDataParser {
  constructor(private readonly baseUrl: string = DEFAULT_BASE_URL) {}

  async parse(data: RawLegalData): Promise<ParsedLegalData[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.content);
    } catch {
      return [];
    }

    const root = findStatuteRoot(parsed);
    const basicInfo = findBasicInfo(root);
    const statuteTitle = extractStatuteTitle(basicInfo);
    const promulgationDate = toDisplayString(basicInfo["공포일자"]);
    const enforcementDate = toDisplayString(basicInfo["시행일자"]);

    const articleItems = findArticleItems(root);
    const orderedIds: string[] = [];
    const bestByDocumentId = new Map<
      string,
      { parsed: ParsedLegalData; richness: number }
    >();

    for (const item of articleItems) {
      const identity = resolveArticleIdentity(item);
      if (!identity) {
        continue;
      }

      const articleTitle = toNonEmptyString(item["조문제목"]);
      const articleContent = toNonEmptyString(item["조문내용"]);
      const paragraphLines = flattenParagraphs(toItemArray(item["항"]));

      if (looksLikeStructuralHeading(articleContent, articleTitle, paragraphLines.length)) {
        continue;
      }

      const hasUsableContent = Boolean(articleContent) || paragraphLines.length > 0;
      if (!hasUsableContent) {
        continue;
      }

      const documentId = `${data.sourceId}:${identity.display}`;
      const richness = contentRichness(articleContent, paragraphLines);
      const existing = bestByDocumentId.get(documentId);
      if (existing && existing.richness >= richness) {
        continue;
      }

      const text = buildArticleText({
        statuteTitle,
        articleDisplay: identity.display,
        articleTitle,
        promulgationDate,
        enforcementDate,
        articleContent,
        paragraphLines,
      });

      const title = `${statuteTitle} 제${identity.display}조${articleTitle ? `(${articleTitle})` : ""}`.trim();

      const document: LegalDocument = {
        id: documentId,
        documentType: "STATUTE_ARTICLE",
        title,
        text,
        metadata: {
          sourceSystem: data.sourceSystem,
          sourceId: data.sourceId,
          sourceUrl: buildLawGoKrStatuteDetailViewUrl(this.baseUrl, data.sourceId, identity.jo),
          retrievedAt: data.collectedAt,
        },
        sourceRef: {
          sourceType: "statute_article",
          sourceId: documentId,
        },
      };

      if (!existing) {
        orderedIds.push(documentId);
      }
      bestByDocumentId.set(documentId, {
        parsed: {
          sourceSystem: data.sourceSystem,
          sourceId: data.sourceId,
          document,
        },
        richness,
      });
    }

    return orderedIds.map((documentId) => bestByDocumentId.get(documentId)!.parsed);
  }
}
