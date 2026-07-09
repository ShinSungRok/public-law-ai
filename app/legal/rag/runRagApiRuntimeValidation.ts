import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import type { FastifyLikeReply } from "../http/FastifyLikeReply";
import type { FastifyLikeRequest } from "../http/FastifyLikeRequest";
import type { FastifyLikeRouteOptions } from "../http/FastifyLikeRouteOptions";
import type { FastifyLikeServer } from "../http/FastifyLikeServer";

const SAMPLE_QUERY = "개인정보 보호";

class FakeFastifyReply implements FastifyLikeReply {
  statusCode: number | undefined;
  headers: Record<string, string> = {};
  sentBody: unknown;

  status(statusCode: number): FastifyLikeReply {
    this.statusCode = statusCode;
    return this;
  }

  header(name: string, value: string): FastifyLikeReply {
    this.headers[name] = value;
    return this;
  }

  send(body: unknown): void {
    this.sentBody = body;
  }
}

class FakeFastifyServer implements FastifyLikeServer {
  readonly registeredRoutes: FastifyLikeRouteOptions[] = [];

  route(options: FastifyLikeRouteOptions): void {
    this.registeredRoutes.push(options);
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

async function main(): Promise<void> {
  console.log("[rag] Creating ApplicationContext via ApplicationBootstrap...");
  const bootstrap = new ApplicationBootstrap(
    new DefaultApplicationContextFactory(),
  );
  const context = bootstrap.bootstrap();

  assertTruthy(context, "ApplicationContext was not created");
  assertTruthy(context.ragController, "ApplicationContext is missing RagController");

  console.log("[rag] Checking RAG route is registered...");
  const routes = context.routeRegistry.getRoutes();
  const ragRoute = routes.find(
    (route) => route.method === "POST" && route.path === "/rag/answer",
  );
  assertTruthy(ragRoute, "POST /rag/answer route is not registered");

  console.log(
    "[rag] Dispatching a fake RAG request through controller-level runtime components...",
  );
  const server = new FakeFastifyServer();
  context.httpAdapter.registerRoutes(server);

  const registeredRagRoute = server.registeredRoutes.find(
    (route) => route.method === "POST" && route.url === "/rag/answer",
  );
  assertTruthy(registeredRagRoute, "adapter did not register POST /rag/answer");

  const ragFastifyRequest: FastifyLikeRequest = {
    method: "POST",
    url: "/rag/answer",
    headers: { "content-type": "application/json" },
    query: {},
    body: { query: SAMPLE_QUERY },
  };
  const reply = new FakeFastifyReply();
  await registeredRagRoute!.handler(ragFastifyRequest, reply);

  assertEqual(reply.statusCode, 200, "RAG API response status code mismatch");

  const responseBody = reply.sentBody as {
    answer: string;
    citations: unknown[];
  };
  assertTruthy(
    typeof responseBody.answer === "string" && responseBody.answer.length > 0,
    "RAG API response is missing a non-empty answer",
  );
  assertTruthy(
    Array.isArray(responseBody.citations) && responseBody.citations.length > 0,
    "RAG API response is missing citations",
  );

  console.log("RAG API runtime validation succeeded.");
}

main();
