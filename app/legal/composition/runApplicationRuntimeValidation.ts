import { ApplicationBootstrap } from "./ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";
import type { FastifyLikeReply } from "../http/FastifyLikeReply";
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

function findRegisteredRoute(
  server: FakeFastifyServer,
  method: string,
  url: string,
): FastifyLikeRouteOptions {
  const found = server.registeredRoutes.find(
    (route) => route.method === method && route.url === url,
  );
  if (!found) {
    throw new Error(`Route not found: ${method} ${url}`);
  }
  return found;
}

async function main(): Promise<void> {
  const bootstrap = new ApplicationBootstrap(
    new DefaultApplicationContextFactory(),
  );
  const context = bootstrap.bootstrap();

  const server = new FakeFastifyServer();
  context.httpAdapter.registerRoutes(server);

  assertEqual(server.registeredRoutes.length, 2, "expected exactly two registered routes");

  const healthRoute = findRegisteredRoute(server, "GET", "/health");
  const ragRoute = findRegisteredRoute(server, "POST", "/rag/answer");

  const healthReply = new FakeFastifyReply();
  await healthRoute.handler(
    { method: "GET", url: "/health", headers: {}, query: {}, body: null },
    healthReply,
  );

  assertTruthy(healthReply.statusCode, "health response missing status code");
  assertTruthy(healthReply.headers, "health response missing headers");
  assertTruthy(healthReply.sentBody, "health response missing body");
  assertEqual(healthReply.statusCode, 200, "health status code mismatch");
  const healthBody = healthReply.sentBody as { status: string; service: string };
  assertEqual(healthBody.status, "UP", "health status field mismatch");

  const ragReply = new FakeFastifyReply();
  await ragRoute.handler(
    {
      method: "POST",
      url: "/rag/answer",
      headers: { "content-type": "application/json" },
      query: {},
      body: { query: SAMPLE_QUERY },
    },
    ragReply,
  );

  assertTruthy(ragReply.statusCode, "rag response missing status code");
  assertTruthy(ragReply.headers, "rag response missing headers");
  assertTruthy(ragReply.sentBody, "rag response missing body");
  assertEqual(ragReply.statusCode, 200, "rag status code mismatch");
  const ragBody = ragReply.sentBody as { answer: string; citations: unknown[] };
  if (typeof ragBody.answer !== "string" || ragBody.answer.length === 0) {
    throw new Error("rag response body missing non-empty answer field");
  }
  if (!Array.isArray(ragBody.citations)) {
    throw new Error("rag response body missing citations array");
  }

  const routes = context.routeRegistry.getRoutes();
  const openApiDocument = context.openApiGenerator.generate(routes);
  assertTruthy(openApiDocument.paths["/health"], "OpenAPI missing /health path");
  assertTruthy(openApiDocument.paths["/rag/answer"], "OpenAPI missing /rag/answer path");

  console.log("Application runtime validation succeeded.");
}

main();
