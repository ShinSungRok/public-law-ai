import type { CourtCaseDocument } from "../domain/CourtCaseDocument";
import type { LegalDocument } from "../domain/LegalDocument";
import type {
  StatuteArticle,
  StatuteArticleParagraph,
} from "../domain/StatuteArticle";

function joinParagraphs(paragraphs: StatuteArticleParagraph[]): string {
  return paragraphs.map((paragraph) => paragraph.text).join("\n");
}

function buildCaseTitle(courtCase: CourtCaseDocument): string {
  return [courtCase.court, courtCase.caseNumber, courtCase.caseName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
}

function combineCaseText(courtCase: CourtCaseDocument): string {
  return [courtCase.holdingGist, courtCase.judgmentSummary]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

export function statuteArticleToLegalDocument(
  article: StatuteArticle,
): LegalDocument {
  return {
    id: article.id,
    documentType: "STATUTE_ARTICLE",
    title: article.articleTitle ?? `Article ${article.articleNo}`,
    text: joinParagraphs(article.paragraphs),
    metadata: article.metadata,
    sourceRef: {
      sourceType: "statute_article",
      sourceId: article.id,
    },
  };
}

export function courtCaseToLegalDocument(
  courtCase: CourtCaseDocument,
): LegalDocument {
  return {
    id: courtCase.id,
    documentType: "COURT_CASE",
    title: buildCaseTitle(courtCase),
    text: combineCaseText(courtCase),
    metadata: courtCase.metadata,
    sourceRef: {
      sourceType: "court_case",
      sourceId: courtCase.id,
    },
  };
}
