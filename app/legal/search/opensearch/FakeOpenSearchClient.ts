import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchHit } from "./OpenSearchSearchResponse";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

const DEFAULT_SIZE = 10;
const TITLE_MATCH_SCORE = 2;
const TEXT_MATCH_SCORE = 1;

interface KeywordSearchBodyShape {
  size?: number;
  query?: {
    multi_match?: {
      query?: string;
    };
  };
}

function isKeywordSearchBodyShape(
  body: unknown,
): body is KeywordSearchBodyShape {
  return typeof body === "object" && body !== null;
}

function extractQueryText(body: unknown): string {
  if (!isKeywordSearchBodyShape(body)) {
    return "";
  }
  const text = body.query?.multi_match?.query;
  return typeof text === "string" ? text : "";
}

function extractSize(body: unknown): number {
  if (!isKeywordSearchBodyShape(body)) {
    return DEFAULT_SIZE;
  }
  return typeof body.size === "number" ? body.size : DEFAULT_SIZE;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function scoreDocument(
  document: OpenSearchLegalDocument,
  tokens: string[],
): number {
  const title = document.title.toLowerCase();
  const text = document.text.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) {
      score += TITLE_MATCH_SCORE;
    }
    if (text.includes(token)) {
      score += TEXT_MATCH_SCORE;
    }
  }

  return score;
}

export class FakeOpenSearchClient implements OpenSearchClient {
  private readonly indices = new Map<string, unknown>();
  private readonly documents = new Map<
    string,
    Map<string, OpenSearchLegalDocument>
  >();

  async indexExists(indexName: string): Promise<boolean> {
    return this.indices.has(indexName);
  }

  async createIndex(indexName: string, mapping: unknown): Promise<void> {
    this.indices.set(indexName, mapping);
    if (!this.documents.has(indexName)) {
      this.documents.set(indexName, new Map());
    }
  }

  async indexDocument(
    indexName: string,
    id: string,
    document: OpenSearchLegalDocument,
  ): Promise<void> {
    const indexDocuments = this.documents.get(indexName) ?? new Map();
    indexDocuments.set(id, document);
    this.documents.set(indexName, indexDocuments);
  }

  async bulkIndex(
    indexName: string,
    documents: OpenSearchLegalDocument[],
  ): Promise<void> {
    for (const document of documents) {
      await this.indexDocument(indexName, document.id, document);
    }
  }

  async search(indexName: string, body: unknown): Promise<unknown> {
    const indexDocuments = this.documents.get(indexName);
    if (!indexDocuments) {
      return { hits: { hits: [] } };
    }

    const tokens = tokenize(extractQueryText(body));
    const size = extractSize(body);

    const hits: OpenSearchHit[] = Array.from(indexDocuments.values())
      .map((document) => ({ document, score: scoreDocument(document, tokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, size)
      .map(({ document, score }) => ({
        _id: document.id,
        _score: score,
        _source: document,
      }));

    return { hits: { hits } };
  }
}
