import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchHit } from "./OpenSearchSearchResponse";
import type { OpenSearchLegalDocument } from "./OpenSearchLegalDocument";

const DEFAULT_SIZE = 10;
const DEFAULT_FIELDS = ["title", "text"];
const DEFAULT_BOOST = 1;
// OpenSearch's own default when minimum_should_match is unset: at least one
// should-clause (i.e. one query token) must match.
const DEFAULT_MINIMUM_SHOULD_MATCH_COUNT = 1;

interface KeywordSearchBodyShape {
  size?: number;
  query?: {
    multi_match?: {
      query?: string;
      fields?: string[];
      tie_breaker?: number;
      minimum_should_match?: string | number;
    };
  };
}

function isKeywordSearchBodyShape(
  body: unknown,
): body is KeywordSearchBodyShape {
  return typeof body === "object" && body !== null;
}

type MultiMatchShape = NonNullable<KeywordSearchBodyShape["query"]>["multi_match"];

function extractMultiMatch(body: unknown): MultiMatchShape {
  if (!isKeywordSearchBodyShape(body)) {
    return undefined;
  }
  return body.query?.multi_match;
}

function extractQueryText(body: unknown): string {
  const text = extractMultiMatch(body)?.query;
  return typeof text === "string" ? text : "";
}

function extractSize(body: unknown): number {
  if (!isKeywordSearchBodyShape(body)) {
    return DEFAULT_SIZE;
  }
  return typeof body.size === "number" ? body.size : DEFAULT_SIZE;
}

/** Parses OpenSearch's "field^boost" syntax (e.g. "title^2") into {name, boost}. */
function parseFieldBoost(field: string): { name: string; boost: number } {
  const [name, boostText] = field.split("^");
  const boost = boostText !== undefined ? Number(boostText) : DEFAULT_BOOST;
  return { name, boost: Number.isFinite(boost) ? boost : DEFAULT_BOOST };
}

function extractFieldBoosts(body: unknown): Array<{ name: string; boost: number }> {
  const fields = extractMultiMatch(body)?.fields;
  if (!fields || fields.length === 0) {
    return DEFAULT_FIELDS.map((name) => ({ name, boost: DEFAULT_BOOST }));
  }
  return fields.map(parseFieldBoost);
}

function extractTieBreaker(body: unknown): number {
  const tieBreaker = extractMultiMatch(body)?.tie_breaker;
  return typeof tieBreaker === "number" ? tieBreaker : 0;
}

/** Resolves minimum_should_match ("70%", "2", 2, or unset) into a required token count out of `tokenCount`. */
function resolveMinimumShouldMatch(body: unknown, tokenCount: number): number {
  const raw = extractMultiMatch(body)?.minimum_should_match;
  if (raw === undefined) {
    return Math.min(DEFAULT_MINIMUM_SHOULD_MATCH_COUNT, tokenCount);
  }

  if (typeof raw === "number") {
    return Math.min(raw, tokenCount);
  }

  const percentMatch = /^(\d+)%$/.exec(raw.trim());
  if (percentMatch) {
    const percent = Number(percentMatch[1]);
    return Math.min(Math.ceil((percent / 100) * tokenCount), tokenCount);
  }

  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? Math.min(asNumber, tokenCount) : DEFAULT_MINIMUM_SHOULD_MATCH_COUNT;
}

// Common Korean case-marking/topic particles frequently glued onto the
// preceding content word with no space (e.g. "개인정보의" = "개인정보" + "의").
// This test double has no real morphological analyzer (see the
// runRagGroundingValidation.ts comment on this same limitation), so without
// stripping these, minimum_should_match would count an unrelated particle
// suffix as "the token never matched" even when the underlying content
// word is present verbatim in the corpus — approximates what a real
// Korean-aware analyzer (e.g. nori) already does at index/query time.
// Sorted longest-first so a longer particle is preferred over a shorter one
// that happens to be its suffix.
const TRAILING_PARTICLES = [
  "으로서", "이라면", "이지만", "이라고", "에서의", "으로부터", "로부터", "에게서",
  "이라는", "이란", "라는", "란", "에서", "에게", "으로", "이나", "라면", "지만", "라고",
  "의", "은", "는", "이", "가", "을", "를", "로", "와", "과", "도", "만", "나",
].sort((a, b) => b.length - a.length);

const MIN_STEM_LENGTH = 2;

/** Best-effort suffix stripping, not real morphological analysis — see TRAILING_PARTICLES. */
function stripTrailingParticle(token: string): string {
  for (const particle of TRAILING_PARTICLES) {
    if (token.length - particle.length >= MIN_STEM_LENGTH && token.endsWith(particle)) {
      return token.slice(0, token.length - particle.length);
    }
  }
  return token;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[?!.,]+$/, ""))
    .filter((token) => token.length > 0)
    .map(stripTrailingParticle);
}

function fieldValue(document: OpenSearchLegalDocument, fieldName: string): string {
  const value = (document as unknown as Record<string, unknown>)[fieldName];
  return typeof value === "string" ? value.toLowerCase() : "";
}

/** BM25-style idf: rarer tokens (lower document frequency) score higher. */
function inverseDocumentFrequency(documentFrequency: number, totalDocumentCount: number): number {
  return Math.log(1 + (totalDocumentCount - documentFrequency + 0.5) / (documentFrequency + 0.5));
}

function countMatchingTokens(
  document: OpenSearchLegalDocument,
  tokens: string[],
  fields: Array<{ name: string }>,
): number {
  return tokens.filter((token) =>
    fields.some((field) => fieldValue(document, field.name).includes(token)),
  ).length;
}

/**
 * Approximates OpenSearch's "best_fields" multi_match scoring: for each
 * field, sum the idf of every matching token (a BM25 stand-in without
 * length normalization, which this fixture-scale test double doesn't need),
 * then combine per-field scores as max(fields) + tieBreaker * sum(rest) —
 * so a document matching multiple fields outranks one matching only its
 * single best field at the same score.
 */
function scoreDocument(
  document: OpenSearchLegalDocument,
  tokens: string[],
  fields: Array<{ name: string; boost: number }>,
  tieBreaker: number,
  documentFrequencyByToken: Map<string, number>,
  totalDocumentCount: number,
): number {
  const fieldScores = fields.map(({ name, boost }) => {
    const value = fieldValue(document, name);
    const tokenScore = tokens.reduce((sum, token) => {
      if (!value.includes(token)) {
        return sum;
      }
      const df = documentFrequencyByToken.get(token) ?? 1;
      return sum + inverseDocumentFrequency(df, totalDocumentCount);
    }, 0);
    return tokenScore * boost;
  });

  if (fieldScores.length === 0) {
    return 0;
  }

  const best = Math.max(...fieldScores);
  const rest = fieldScores.reduce((sum, score) => sum + score, 0) - best;
  return best + tieBreaker * rest;
}

interface KnnSearchBodyShape {
  size?: number;
  query?: {
    knn?: Record<string, { vector?: number[]; k?: number }>;
  };
}

interface KnnQuery {
  field: string;
  vector: number[];
  k: number;
}

function extractKnnQuery(body: unknown): KnnQuery | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const knn = (body as KnnSearchBodyShape).query?.knn;
  if (!knn) {
    return undefined;
  }

  const [field, clause] = Object.entries(knn)[0] ?? [];
  if (!field || !clause?.vector) {
    return undefined;
  }

  return { field, vector: clause.vector, k: clause.k ?? extractSize(body) };
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
}

function magnitude(vector: number[]): number {
  return Math.sqrt(dotProduct(vector, vector));
}

/** Cosine similarity in [-1, 1]; 0 when either vector has no magnitude to compare a direction against. */
function cosineSimilarity(a: number[], b: number[]): number {
  const denominator = magnitude(a) * magnitude(b);
  return denominator === 0 ? 0 : dotProduct(a, b) / denominator;
}

function vectorFieldValue(
  document: OpenSearchLegalDocument,
  field: string,
): number[] | undefined {
  const value = (document as unknown as Record<string, unknown>)[field];
  return Array.isArray(value) ? (value as number[]) : undefined;
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

    const knnQuery = extractKnnQuery(body);
    if (knnQuery) {
      return this.searchByVector(Array.from(indexDocuments.values()), knnQuery);
    }

    const tokens = tokenize(extractQueryText(body));
    const size = extractSize(body);
    const fields = extractFieldBoosts(body);
    const tieBreaker = extractTieBreaker(body);
    const requiredMatches = resolveMinimumShouldMatch(body, tokens.length);

    const allDocuments = Array.from(indexDocuments.values());
    const totalDocumentCount = allDocuments.length;
    const documentFrequencyByToken = new Map<string, number>(
      tokens.map((token) => [
        token,
        allDocuments.filter((document) => countMatchingTokens(document, [token], fields) > 0).length,
      ]),
    );

    const hits: OpenSearchHit[] = allDocuments
      .filter((document) => countMatchingTokens(document, tokens, fields) >= requiredMatches)
      .map((document) => ({
        document,
        score: scoreDocument(document, tokens, fields, tieBreaker, documentFrequencyByToken, totalDocumentCount),
      }))
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

  /** Deterministic kNN stand-in: ranks by cosine similarity against each document's stored vector field. */
  private searchByVector(
    documents: OpenSearchLegalDocument[],
    knnQuery: KnnQuery,
  ): { hits: { hits: OpenSearchHit[] } } {
    const hits: OpenSearchHit[] = documents
      .map((document) => {
        const vector = vectorFieldValue(document, knnQuery.field);
        return vector === undefined
          ? undefined
          : { document, score: cosineSimilarity(knnQuery.vector, vector) };
      })
      .filter((entry): entry is { document: OpenSearchLegalDocument; score: number } => entry !== undefined)
      .sort((a, b) => b.score - a.score)
      .slice(0, knnQuery.k)
      .map(({ document, score }) => ({
        _id: document.id,
        _score: score,
        _source: document,
      }));

    return { hits: { hits } };
  }
}
