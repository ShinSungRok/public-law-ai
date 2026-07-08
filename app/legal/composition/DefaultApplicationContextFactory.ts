import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { RagApplicationService } from "../application/RagApplicationService";
import type { LLMCompletionRequest } from "../../ai/provider/LLMProvider";
import type { LLMProvider } from "../../ai/provider/LLMProvider";
import type { AIResponseStream } from "../../ai/model/AIResponse";
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
import { InMemoryHttpRouteRegistry } from "../http/InMemoryHttpRouteRegistry";
import { OpenApiGenerator } from "../http/OpenApiGenerator";
import { createRagHttpRoute } from "../http/RagHttpRouteFactory";
import type { ApplicationContext } from "./ApplicationContext";
import type { ApplicationContextFactory } from "./ApplicationContextFactory";

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

export class DefaultApplicationContextFactory implements ApplicationContextFactory {
  create(): ApplicationContext {
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

    return {
      healthController,
      ragController,
      routeRegistry,
      requestMapper,
      responseMapper,
      httpAdapter,
      openApiGenerator,
    };
  }
}
