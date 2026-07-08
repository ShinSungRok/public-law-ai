import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { RagApplicationService } from "../application/RagApplicationService";
import type { LLMCompletionRequest } from "../../ai/provider/LLMProvider";
import type { LLMProvider } from "../../ai/provider/LLMProvider";
import type { AIResponseStream } from "../../ai/model/AIResponse";
import { DefaultAiProviderFactory } from "../ai/DefaultAiProviderFactory";
import { DefaultAiPromptExecutor } from "../ai/DefaultAiPromptExecutor";
import type { LegalDocument } from "../domain";
import { HealthController } from "../api/HealthController";
import { RagController } from "../api/RagController";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { DefaultApiConfigurationFactory } from "../server/DefaultApiConfigurationFactory";
import { DefaultHttpRequestMapper } from "../http/DefaultHttpRequestMapper";
import { DefaultHttpResponseMapper } from "../http/DefaultHttpResponseMapper";
import { FastifyHttpAdapter } from "../http/FastifyHttpAdapter";
import { createHealthHttpRoute } from "../http/HealthHttpRouteFactory";
import type { HttpRequest } from "../http/HttpRequest";
import { InMemoryHttpRouteRegistry } from "../http/InMemoryHttpRouteRegistry";
import { OpenApiGenerator } from "../http/OpenApiGenerator";
import { createRagHttpRoute } from "../http/RagHttpRouteFactory";
import type { ApplicationContext } from "./ApplicationContext";

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
      yield { text: "This is a fake generated answer based on the retrieved legal context." };
      yield { text: ` Prompt length: ${request.prompt.length}.` };
    })();
  }
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function buildApplicationContext(): ApplicationContext {
  const apiConfiguration = new DefaultApiConfigurationFactory().create();
  const healthController = new HealthController(apiConfiguration);

  const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
  const retriever = new KeywordRetriever(repository);
  const llmProvider = new FakeLLMProvider();
  const ragAnswerBuilder = new RagAnswerBuilder(new DefaultCitationExtractor());
  const generateRagAnswerUseCase = new GenerateRagAnswerUseCase(
    retriever,
    llmProvider,
    ragAnswerBuilder,
  );
  const ragApplicationService = new RagApplicationService(
    generateRagAnswerUseCase,
  );
  const ragController = new RagController(ragApplicationService);

  const routeRegistry = new InMemoryHttpRouteRegistry();
  routeRegistry.register(createHealthHttpRoute(healthController));
  routeRegistry.register(createRagHttpRoute(ragController));

  const requestMapper = new DefaultHttpRequestMapper();
  const responseMapper = new DefaultHttpResponseMapper();
  const httpAdapter = new FastifyHttpAdapter(
    routeRegistry,
    requestMapper,
    responseMapper,
  );
  const openApiGenerator = new OpenApiGenerator();

  const aiProvider = new DefaultAiProviderFactory().create("fake");
  const aiPromptExecutor = new DefaultAiPromptExecutor(aiProvider);

  return {
    healthController,
    ragController,
    routeRegistry,
    requestMapper,
    responseMapper,
    httpAdapter,
    openApiGenerator,
    aiProvider,
    aiPromptExecutor,
  };
}

async function main(): Promise<void> {
  const context = buildApplicationContext();

  assertTruthy(context.healthController, "healthController missing");
  assertTruthy(context.ragController, "ragController missing");
  assertTruthy(context.routeRegistry, "routeRegistry missing");
  assertTruthy(context.requestMapper, "requestMapper missing");
  assertTruthy(context.responseMapper, "responseMapper missing");
  assertTruthy(context.httpAdapter, "httpAdapter missing");
  assertTruthy(context.openApiGenerator, "openApiGenerator missing");
  assertTruthy(context.aiProvider, "aiProvider missing");
  assertTruthy(context.aiPromptExecutor, "aiPromptExecutor missing");

  const initialRoutes = context.routeRegistry.getRoutes();
  assertEqual(initialRoutes.length, 2, "routeRegistry route count mismatch");
  assertTruthy(
    initialRoutes.some((route) => route.path === "/health"),
    "routeRegistry missing /health route",
  );
  assertTruthy(
    initialRoutes.some((route) => route.path === "/rag/answer"),
    "routeRegistry missing /rag/answer route",
  );

  const getRequest: HttpRequest = {
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    body: null,
  };
  const mappedRequest = context.requestMapper.map({
    method: getRequest.method,
    path: getRequest.path,
    headers: getRequest.headers,
    query: getRequest.query,
    body: getRequest.body,
  });
  assertEqual(mappedRequest.method, "GET", "requestMapper method mismatch");
  assertEqual(mappedRequest.path, "/health", "requestMapper path mismatch");

  const mappedResponse = context.responseMapper.map({
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: { status: "UP" },
  });
  assertEqual(mappedResponse.statusCode, 200, "responseMapper statusCode mismatch");
  assertEqual(
    mappedResponse.headers["content-type"],
    "application/json",
    "responseMapper headers mismatch",
  );

  const openApiDocument = context.openApiGenerator.generate(initialRoutes);
  assertTruthy(openApiDocument.openapi, "openApiGenerator missing openapi version");
  assertTruthy(openApiDocument.paths["/health"], "openApiGenerator missing /health path");
  assertTruthy(
    openApiDocument.paths["/rag/answer"],
    "openApiGenerator missing /rag/answer path",
  );

  console.log("Application context validation succeeded.");
}

main();
