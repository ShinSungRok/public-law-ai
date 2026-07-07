import type { LegalSourceMetadata } from "./LegalSourceMetadata";

export interface StatuteArticleParagraph {
  no: string;
  text: string;
}

export interface StatuteArticle {
  id: string;
  statuteId: string;
  articleNo: string;
  articleTitle?: string;
  paragraphs: StatuteArticleParagraph[];
  effectiveDate: string;
  metadata: LegalSourceMetadata;
}
