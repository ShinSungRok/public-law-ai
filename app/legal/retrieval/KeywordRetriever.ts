import type { LegalDocument } from "../domain/LegalDocument";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import type { RetrievalResult, RetrievedDocument } from "./RetrievalResult";
import type { Retriever } from "./Retriever";

const TITLE_MATCH_SCORE = 2;
const TEXT_MATCH_SCORE = 1;

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function scoreDocument(
  document: LegalDocument,
  tokens: string[],
): RetrievedDocument {
  const title = document.title.toLowerCase();
  const text = document.text.toLowerCase();
  let score = 0;
  const matchedTerms: string[] = [];

  for (const token of tokens) {
    const matchesTitle = title.includes(token);
    const matchesText = text.includes(token);

    if (matchesTitle) {
      score += TITLE_MATCH_SCORE;
    }
    if (matchesText) {
      score += TEXT_MATCH_SCORE;
    }
    if (matchesTitle || matchesText) {
      matchedTerms.push(token);
    }
  }

  return { document, score, matchedTerms };
}

export class KeywordRetriever implements Retriever {
  constructor(private readonly repository: LegalDocumentRepository) {}

  async retrieve(query: string): Promise<RetrievalResult> {
    const tokens = tokenize(query);
    const allDocuments = await this.repository.listAll();

    const documents = allDocuments
      .map((document) => scoreDocument(document, tokens))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return { query, documents };
  }
}
