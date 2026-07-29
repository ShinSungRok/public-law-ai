import { GenerateRagAnswerUseCase } from "../application/GenerateRagAnswerUseCase";
import { RagApplicationService } from "../application/RagApplicationService";
import { AiPromptExecutorLlmProviderAdapter } from "../ai/AiPromptExecutorLlmProviderAdapter";
import { DefaultAiProviderFactory } from "../ai/DefaultAiProviderFactory";
import { DefaultAiPromptExecutor } from "../ai/DefaultAiPromptExecutor";
import { EnvironmentLlmConfigurationFactory } from "../ai/EnvironmentLlmConfigurationFactory";
import type { LlmConfiguration } from "../ai/LlmConfiguration";
import { DefaultApplicationConfigurationValidator } from "../config/DefaultApplicationConfigurationValidator";
import { EnvironmentApplicationConfigurationFactory } from "../config/EnvironmentApplicationConfigurationFactory";
import type { LegalDocument } from "../domain";
import { HealthController } from "../api/HealthController";
import { RagController } from "../api/RagController";
import { DefaultCitationExtractor } from "../rag/DefaultCitationExtractor";
import { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import { KeywordRetriever } from "../retrieval/KeywordRetriever";
import { SearchEngineRetriever } from "../retrieval/SearchEngineRetriever";
import type { Retriever } from "../retrieval/Retriever";
import type { LegalDocumentRepository } from "../repository/LegalDocumentRepository";
import { GeminiEmbeddingProvider } from "../embedding/GeminiEmbeddingProvider";
import type { EmbeddingProvider } from "../embedding/EmbeddingProvider";
import { HybridSearchEngine } from "../search/HybridSearchEngine";
import { ReciprocalRankFusionStrategy } from "../search/ReciprocalRankFusionStrategy";
import type { SearchEngine } from "../search/SearchEngine";
import type { OpenSearchClient } from "../search/opensearch/OpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import {
  createOpenSearchConfigFromEnv,
  shouldUseOpenSearchEngine,
} from "../search/opensearch/OpenSearchConfigFactory";
import { OpenSearchSdkClient } from "../search/opensearch/OpenSearchSdkClient";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import { OpenSearchVectorSearchEngine } from "../search/opensearch/OpenSearchVectorSearchEngine";
import { DefaultApiConfigurationFactory } from "../server/DefaultApiConfigurationFactory";
import { DefaultHttpRequestMapper } from "../http/DefaultHttpRequestMapper";
import { DefaultHttpResponseMapper } from "../http/DefaultHttpResponseMapper";
import { FastifyHttpAdapter } from "../http/FastifyHttpAdapter";
import { createHealthHttpRoute } from "../http/HealthHttpRouteFactory";
import { InMemoryHttpRouteRegistry } from "../http/InMemoryHttpRouteRegistry";
import { OpenApiGenerator } from "../http/OpenApiGenerator";
import { createRagHttpRoute } from "../http/RagHttpRouteFactory";
import { ConsoleLogger } from "../observability/ConsoleLogger";
import { InMemoryHealthCheckService } from "../observability/InMemoryHealthCheckService";
import { InMemoryMetricsCollector } from "../observability/InMemoryMetricsCollector";
import type { ObservabilityService } from "../observability/ObservabilityService";
import { DefaultSecurityReliabilityServiceFactory } from "../reliability/DefaultSecurityReliabilityServiceFactory";
import { ResilientLlmProviderDecorator } from "../reliability/ResilientLlmProviderDecorator";
import type { SecurityReliabilityService } from "../reliability/SecurityReliabilityService";
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

export class DefaultApplicationContextFactory implements ApplicationContextFactory {
  constructor(
    private readonly openSearchClient?: OpenSearchClient,
    private readonly embeddingProvider?: EmbeddingProvider,
  ) {}

  create(): ApplicationContext {
    const applicationConfiguration = new EnvironmentApplicationConfigurationFactory().create();
    new DefaultApplicationConfigurationValidator().validate(applicationConfiguration);

    const apiConfiguration = new DefaultApiConfigurationFactory().create();
    const healthController = new HealthController(apiConfiguration);

    const llmConfigurationFactory = new EnvironmentLlmConfigurationFactory();
    const llmConfiguration: LlmConfiguration = applicationConfiguration.ai;
    const aiProvider = new DefaultAiProviderFactory().create(
      llmConfiguration.provider,
      llmConfiguration,
    );
    const aiPromptExecutor = new DefaultAiPromptExecutor(aiProvider);

    const securityReliabilityService: SecurityReliabilityService =
      new DefaultSecurityReliabilityServiceFactory().create();
    const observabilityService: ObservabilityService = this.createObservabilityService(
      llmConfiguration,
    );

    const retriever = this.createRetriever(llmConfiguration);
    const baseLlmProvider = new AiPromptExecutorLlmProviderAdapter(
      aiPromptExecutor,
      llmConfiguration.model,
    );
    const llmProvider = new ResilientLlmProviderDecorator(
      baseLlmProvider,
      securityReliabilityService.retryPolicy,
      securityReliabilityService.timeoutPolicy,
      securityReliabilityService.circuitBreaker,
    );
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
      observabilityService,
      securityReliabilityService,
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
      aiProvider,
      aiPromptExecutor,
      llmConfiguration,
      llmConfigurationFactory,
      applicationConfiguration,
      observabilityService,
      securityReliabilityService,
    };
  }

  private createObservabilityService(
    llmConfiguration: LlmConfiguration,
  ): ObservabilityService {
    const healthCheckService = new InMemoryHealthCheckService();

    healthCheckService.registerDependency("ai-provider", () => {
      const isConfigured =
        llmConfiguration.provider === "fake" || llmConfiguration.apiKey.trim().length > 0;
      return {
        status: isConfigured ? "healthy" : "unhealthy",
        message: `provider=${llmConfiguration.provider}`,
      };
    });

    healthCheckService.registerDependency("search-retrieval", () => {
      if (!shouldUseOpenSearchEngine()) {
        return { status: "healthy", message: "keyword (in-memory)" };
      }
      const hasEmbeddingProvider = this.createEmbeddingProvider(llmConfiguration) !== undefined;
      return {
        status: "healthy",
        message: hasEmbeddingProvider ? "opensearch (hybrid: bm25+vector)" : "opensearch (bm25)",
      };
    });

    return {
      logger: new ConsoleLogger("public-law-ai"),
      metricsCollector: new InMemoryMetricsCollector(),
      healthCheckService,
    };
  }

  private createRetriever(llmConfiguration: LlmConfiguration): Retriever {
    if (shouldUseOpenSearchEngine()) {
      const openSearchConfig = createOpenSearchConfigFromEnv();
      const client = this.openSearchClient ?? new OpenSearchSdkClient(openSearchConfig);
      const searchEngine = this.createOpenSearchSearchEngine(client, openSearchConfig, llmConfiguration);
      return new SearchEngineRetriever(searchEngine);
    }

    const repository = new InMemoryLegalDocumentRepository(SAMPLE_DOCUMENTS);
    return new KeywordRetriever(repository);
  }

  /**
   * BM25-only when no EmbeddingProvider is available; Hybrid (BM25 + kNN
   * vector, fused via Reciprocal Rank Fusion) once one is — combining exact
   * keyword/citation matching with semantic recall for paraphrased
   * questions the BM25-only path cannot reach.
   */
  private createOpenSearchSearchEngine(
    client: OpenSearchClient,
    openSearchConfig: OpenSearchConfig,
    llmConfiguration: LlmConfiguration,
  ): SearchEngine {
    const keywordEngine = new OpenSearchSearchEngine(client, openSearchConfig);

    const embeddingProvider = this.createEmbeddingProvider(llmConfiguration);
    if (!embeddingProvider) {
      return keywordEngine;
    }

    const vectorEngine = new OpenSearchVectorSearchEngine(client, openSearchConfig, embeddingProvider);
    return new HybridSearchEngine(
      [
        { engine: keywordEngine, source: "opensearch" },
        { engine: vectorEngine, source: "opensearch" },
      ],
      undefined,
      new ReciprocalRankFusionStrategy(),
    );
  }

  /**
   * this.embeddingProvider (constructor injection) lets validations exercise
   * the Hybrid path deterministically. Absent that, only Gemini has a real
   * EmbeddingProvider today (GeminiEmbeddingProvider, reusing the same
   * LLM_API_KEY as chat completion) — other providers/fake fall back to
   * keyword-only retrieval rather than silently indexing or querying against
   * a meaningless embedding.
   */
  private createEmbeddingProvider(
    llmConfiguration: LlmConfiguration,
  ): EmbeddingProvider | undefined {
    if (this.embeddingProvider) {
      return this.embeddingProvider;
    }
    if (llmConfiguration.provider !== "gemini" || !llmConfiguration.apiKey.trim()) {
      return undefined;
    }
    return new GeminiEmbeddingProvider(llmConfiguration.apiKey);
  }
}
