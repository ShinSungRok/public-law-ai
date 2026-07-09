import type { AIResponseStream } from "../../ai/model/AIResponse";
import type {
  LLMCompletionRequest,
  LLMProvider,
} from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { buildPromptContext } from "../context/PromptContextBuilder";
import type { LegalDocument } from "../domain";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import { KeywordSearchEngine } from "../search/KeywordSearchEngine";
import type { SearchResult } from "../search/model/SearchResult";
import { DefaultCitationExtractor } from "./DefaultCitationExtractor";
import { RagAnswerBuilder } from "./RagAnswerBuilder";

const SAMPLE_QUERY = "개인정보 보호";
const FAKE_ANSWER_MARKER = "fake generated answer";

const SAMPLE_DOCUMENTS: LegalDocument[] = [
  {
    id: "fake-statute-article-1",
    documentType: "STATUTE_ARTICLE",
    title: "개인정보 보호법 제1조",
    text: "이 법은 개인정보의 처리 및 보호에 관한 사항을 정함으로써 개인의 자유와 권리를 보호한다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "fake-statute-article-1",
      sourceUrl: "https://fake.local/statutes/1",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: {
      sourceType: "statute_article",
      sourceId: "fake-statute-article-1",
    },
  },
  {
    id: "fake-statute-article-2",
    documentType: "STATUTE_ARTICLE",
    title: "개인정보 보호법 제2조",
    text: "개인정보 보호에 관한 정의는 다음과 같다.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "fake-statute-article-2",
      sourceUrl: "https://fake.local/statutes/2",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: {
      sourceType: "statute_article",
      sourceId: "fake-statute-article-2",
    },
  },
];

class InMemoryLegalDocumentRepository implements LegalDocumentRepository {
  constructor(private readonly documents: LegalDocument[]) {}

  async getById(id: string): Promise<LegalDocument | null> {
    return this.documents.find((document) => document.id === id) ?? null;
  }

  async listAll(): Promise<LegalDocument[]> {
    return this.documents;
  }
}

class FakeLLMProvider implements LLMProvider {
  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    return (async function* (): AIResponseStream {
      yield { text: `This is a ${FAKE_ANSWER_MARKER}.` };
      yield { text: ` Prompt length: ${request.prompt.length}.` };
    })();
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function toSearchResult(retrievedDocument: {
  document: LegalDocument;
  score: number;
}): SearchResult {
  return {
    document: retrievedDocument.document,
    score: retrievedDocument.score,
    source: "keyword",
  };
}

async function main(): Promise<void> {
  const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
  const keywordRetriever = new KeywordRetriever(repository);
  const searchEngine = new KeywordSearchEngine(keywordRetriever);
  const retriever = new SearchEngineRetriever(searchEngine);

  console.log("[rag] Checking SearchHit carries document metadata required by RAG...");
  const searchHits = await searchEngine.search({ text: SAMPLE_QUERY });
  assertTruthy(searchHits.length > 0, "search engine did not return any hits");
  for (const hit of searchHits) {
    const originalDocument = SAMPLE_DOCUMENTS.find(
      (document) => document.id === hit.document.id,
    );
    assertTruthy(originalDocument, `search hit references unknown document: ${hit.id}`);
    assertTruthy(hit.document.title, "search hit document is missing a title");
    assertTruthy(hit.document.text, "search hit document is missing text content");
    assertTruthy(
      hit.document.metadata.sourceUrl,
      "search hit document is missing metadata.sourceUrl",
    );
    assertTruthy(
      hit.document.sourceRef?.sourceId,
      "search hit document is missing sourceRef.sourceId",
    );
  }

  console.log("[rag] Checking search results flow through SearchEngineRetriever...");
  const retrievalResult = await retriever.retrieve(SAMPLE_QUERY);
  assertTruthy(
    retrievalResult.documents.length === searchHits.length,
    "SearchEngineRetriever did not preserve the number of search hits",
  );
  assertTruthy(
    retrievalResult.documents.every((retrievedDocument) =>
      SAMPLE_DOCUMENTS.some(
        (document) => document.id === retrievedDocument.document.id,
      ),
    ),
    "SearchEngineRetriever returned a document not present in the original search results",
  );

  console.log("[rag] Checking prompt context preserves document id/title/content/source...");
  const promptContext = buildPromptContext(retrievalResult);
  assertTruthy(
    promptContext.documents.length === retrievalResult.documents.length,
    "prompt context lost documents from the retrieval result",
  );
  for (const contextDocument of promptContext.documents) {
    const originalDocument = SAMPLE_DOCUMENTS.find(
      (document) => document.id === contextDocument.id,
    );
    assertTruthy(
      originalDocument,
      `prompt context document id not found in original search results: ${contextDocument.id}`,
    );
    assertTruthy(
      contextDocument.title === originalDocument!.title,
      `prompt context lost the title for document ${contextDocument.id}`,
    );
    assertTruthy(
      contextDocument.text === originalDocument!.text,
      `prompt context lost the content for document ${contextDocument.id}`,
    );
    assertTruthy(
      contextDocument.citation.sourceUrl === originalDocument!.metadata.sourceUrl,
      `prompt context lost source information for document ${contextDocument.id}`,
    );
  }

  console.log("[rag] Checking citation extraction references the same documents...");
  const searchResults = retrievalResult.documents.map(toSearchResult);
  const citations = new DefaultCitationExtractor().extract(searchResults);
  assertTruthy(
    citations.length === searchResults.length,
    "citation extractor did not produce a citation per search result",
  );
  for (const citation of citations) {
    const originalDocument = SAMPLE_DOCUMENTS.find(
      (document) => document.sourceRef.sourceId === citation.sourceId,
    );
    assertTruthy(
      originalDocument,
      `citation does not reference a known search result: ${citation.sourceId}`,
    );
    assertTruthy(
      citation.sourceUrl === originalDocument!.metadata.sourceUrl,
      `citation sourceUrl does not match the original search result for ${citation.sourceId}`,
    );
  }

  console.log("[rag] Checking final RAG answer citations connect back to search results...");
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const useCase = new GenerateRagAnswerUseCase(
    retriever,
    new FakeLLMProvider(),
    ragAnswerBuilder,
  );
  const ragAnswer = await useCase.execute(SAMPLE_QUERY);
  assertTruthy(
    ragAnswer.answer.includes(FAKE_ANSWER_MARKER),
    "final RAG answer does not include the expected generated text",
  );
  assertTruthy(
    ragAnswer.citations.length === searchHits.length,
    "final RAG answer citation count does not match the original search results",
  );
  const searchResultSourceIds = new Set(
    searchHits.map((hit) => hit.document.sourceRef.sourceId),
  );
  for (const citation of ragAnswer.citations) {
    assertTruthy(
      searchResultSourceIds.has(citation.sourceId),
      `final RAG answer citation is not connected to a search result: ${citation.sourceId}`,
    );
  }

  console.log("Search-to-RAG integration validation succeeded.");
}

main();
