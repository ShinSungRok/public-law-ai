import { ApplicationBootstrap } from "./ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";
import type { FastifyLikeReply } from "../http/FastifyLikeReply";
import type { FastifyLikeRouteOptions } from "../http/FastifyLikeRouteOptions";
import type { FastifyLikeServer } from "../http/FastifyLikeServer";

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
  const bootstrap = new ApplicationBootstrap(
    new DefaultApplicationContextFactory(),
  );
  const context = bootstrap.bootstrap();

  assertTruthy(context, "ApplicationContext missing");

  const routes = context.routeRegistry.getRoutes();
  assertEqual(routes.length, 2, "expected exactly two registered routes");

  const healthRoute = routes.find(
    (route) => route.method === "GET" && route.path === "/health",
  );
  assertTruthy(healthRoute, "GET /health route missing");

  const ragRoute = routes.find(
    (route) => route.method === "POST" && route.path === "/rag/answer",
  );
  assertTruthy(ragRoute, "POST /rag/answer route missing");

  const openApiDocument = context.openApiGenerator.generate(routes);
  assertTruthy(openApiDocument.openapi, "openApiGenerator missing openapi version");
  assertTruthy(openApiDocument.paths["/health"], "openApiGenerator missing /health path");
  assertTruthy(
    openApiDocument.paths["/rag/answer"],
    "openApiGenerator missing /rag/answer path",
  );

  const server = new FakeFastifyServer();
  context.httpAdapter.registerRoutes(server);
  assertEqual(
    server.registeredRoutes.length,
    2,
    "adapter did not register exactly two routes into fake server",
  );

  const registeredHealthRoute = server.registeredRoutes.find(
    (route) => route.method === "GET" && route.url === "/health",
  );
  assertTruthy(registeredHealthRoute, "adapter missing GET /health registration");

  const reply = new FakeFastifyReply();
  await registeredHealthRoute?.handler(
    { method: "GET", url: "/health", headers: {}, query: {}, body: null },
    reply,
  );
  assertEqual(reply.statusCode, 200, "adapter health invocation statusCode mismatch");

  console.log("Application bootstrap validation succeeded.");
}

main();
