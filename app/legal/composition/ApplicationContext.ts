import type { AiPromptExecutor, AiProvider } from "../ai";
import type { HealthController } from "../api/HealthController";
import type { RagController } from "../api/RagController";
import type { FastifyHttpAdapter } from "../http/FastifyHttpAdapter";
import type { HttpRequestMapper } from "../http/HttpRequestMapper";
import type { HttpResponseMapper } from "../http/HttpResponseMapper";
import type { HttpRouteRegistry } from "../http/HttpRouteRegistry";
import type { OpenApiGenerator } from "../http/OpenApiGenerator";

export interface ApplicationContext {
  healthController: HealthController;
  ragController: RagController;
  routeRegistry: HttpRouteRegistry;
  requestMapper: HttpRequestMapper;
  responseMapper: HttpResponseMapper;
  httpAdapter: FastifyHttpAdapter;
  openApiGenerator: OpenApiGenerator;
  aiProvider: AiProvider;
  aiPromptExecutor: AiPromptExecutor;
}
