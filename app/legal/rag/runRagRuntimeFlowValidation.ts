import type { AIResponseStream } from "../../ai/model/AIResponse";
import type {
  LLMCompletionRequest,
  LLMProvider,
} from "../../ai/provider/LLMProvider";
import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { buildPromptContext } from "../context/PromptContextBuilder";
import type { LegalDocument } from "../domain";
import { buildLegalPromptRequest } from "../prompt/LegalPromptBuilder";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { SearchResult } from "../search/model/SearchResult";
import { DefaultCitationExtractor } from "./DefaultCitationExtractor";
import { RagAnswerBuilder } from "./RagAnswerBuilder";

const SAMPLE_QUERY = "개인정보 보호";
const FAKE_ANSWER_MARKER =
  "This is a fake generated answer based on the retrieved legal context.";

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
      yield { text: FAKE_ANSWER_MARKER };
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
  const retriever = new KeywordRetriever(repository);
  const llmProvider = new FakeLLMProvider();
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());

  console.log("[rag] Stage 1: retrieval...");
  const retrievalResult = await retriever.retrieve(SAMPLE_QUERY);
  assertTruthy(
    retrievalResult.documents.length > 0,
    "retriever did not return any documents for the sample query",
  );
  assertTruthy(
    retrievalResult.documents[0].document.id === SAMPLE_DOCUMENTS[0].id,
    "retriever did not return the expected sample document",
  );

  console.log("[rag] Stage 2: prompt building...");
  const promptContext = buildPromptContext(retrievalResult);
  const promptRequest = buildLegalPromptRequest(promptContext);
  assertTruthy(
    promptRequest.prompt.includes(SAMPLE_DOCUMENTS[0].title),
    "prompt request does not include the retrieved document context",
  );
  assertTruthy(
    promptRequest.prompt.includes(SAMPLE_QUERY),
    "prompt request does not include the user query",
  );

  console.log("[rag] Stage 3: AI provider response...");
  let answer = "";
  for await (const chunk of llmProvider.streamCompletion(promptRequest)) {
    answer += chunk.text;
  }
  assertTruthy(
    answer.includes(FAKE_ANSWER_MARKER),
    "AI provider did not produce the expected fake answer",
  );
  assertTruthy(
    answer.includes(`Prompt length: ${promptRequest.prompt.length}.`),
    "AI provider response does not reflect the built prompt",
  );

  console.log("[rag] Stage 4: RagAnswerBuilder / citation extraction...");
  const searchResults = retrievalResult.documents.map(toSearchResult);
  const ragAnswer = ragAnswerBuilder.build(answer, searchResults);
  assertTruthy(
    ragAnswer.citations.length > 0,
    "RagAnswerBuilder did not produce any citations",
  );
  assertTruthy(
    ragAnswer.citations[0].sourceUrl === SAMPLE_DOCUMENTS[0].metadata.sourceUrl,
    "citation sourceUrl does not match the retrieved document",
  );

  console.log("[rag] Stage 5: full end-to-end use case...");
  const useCase = new GenerateRagAnswerUseCase(
    retriever,
    llmProvider,
    ragAnswerBuilder,
  );
  const endToEndAnswer = await useCase.execute(SAMPLE_QUERY);
  assertTruthy(
    endToEndAnswer.answer.includes(FAKE_ANSWER_MARKER),
    "end-to-end RagAnswer does not include the expected fake answer",
  );
  assertTruthy(
    endToEndAnswer.citations.length === ragAnswer.citations.length,
    "end-to-end RagAnswer citation count does not match the stage-by-stage result",
  );

  console.log("RAG runtime flow validation succeeded.");
}

main();
