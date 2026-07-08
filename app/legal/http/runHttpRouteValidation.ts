import type { HttpHandler } from "./HttpHandler";
import type { HttpRequest } from "./HttpRequest";
import type { HttpResponse } from "./HttpResponse";
import type { HttpRoute } from "./HttpRoute";
import { InMemoryHttpRouteRegistry } from "./InMemoryHttpRouteRegistry";

class FakeHealthHandler implements HttpHandler {
  async handle(): Promise<HttpResponse> {
    return {
      statusCode: 200,
      headers: {},
      body: { status: "UP" },
    };
  }
}

class FakeRagHandler implements HttpHandler {
  async handle(request: HttpRequest): Promise<HttpResponse> {
    return {
      statusCode: 200,
      headers: {},
      body: { echoedBody: request.body },
    };
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
  const registry = new InMemoryHttpRouteRegistry();

  const healthRoute: HttpRoute = {
    method: "GET",
    path: "/health",
    handler: new FakeHealthHandler(),
  };
  const ragRoute: HttpRoute = {
    method: "POST",
    path: "/rag/answer",
    handler: new FakeRagHandler(),
  };

  registry.register(healthRoute);
  registry.register(ragRoute);

  const routes = registry.getRoutes();

  assertEqual(routes.length, 2, "route count mismatch");
  assertEqual(routes[0].path, healthRoute.path, "first route order mismatch");
  assertEqual(routes[1].path, ragRoute.path, "second route order mismatch");

  routes.push({
    method: "DELETE",
    path: "/should-not-persist",
    handler: new FakeHealthHandler(),
  });
  assertEqual(
    registry.getRoutes().length,
    2,
    "getRoutes() did not return a defensive copy",
  );

  const request: HttpRequest = {
    method: "POST",
    path: "/rag/answer",
    headers: {},
    query: {},
    body: { query: "개인정보 보호" },
  };
  const response = await ragRoute.handler.handle(request);

  assertEqual(response.statusCode, 200, "handler statusCode mismatch");
  const responseBody = response.body as { echoedBody: unknown };
  assertEqual(
    JSON.stringify(responseBody.echoedBody),
    JSON.stringify(request.body),
    "handler echoedBody mismatch",
  );

  console.log("HTTP route registry validation succeeded.");
}

main();
