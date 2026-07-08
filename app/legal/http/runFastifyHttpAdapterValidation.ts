import { DefaultHttpRequestMapper } from "./DefaultHttpRequestMapper";
import { DefaultHttpResponseMapper } from "./DefaultHttpResponseMapper";
import { FastifyHttpAdapter } from "./FastifyHttpAdapter";
import type { FastifyLikeReply } from "./FastifyLikeReply";
import type { FastifyLikeRequest } from "./FastifyLikeRequest";
import type { FastifyLikeRouteOptions } from "./FastifyLikeRouteOptions";
import type { FastifyLikeServer } from "./FastifyLikeServer";
import type { HttpHandler } from "./HttpHandler";
import type { HttpRequest } from "./HttpRequest";
import type { HttpResponse } from "./HttpResponse";
import type { HttpRoute } from "./HttpRoute";
import { InMemoryHttpRouteRegistry } from "./InMemoryHttpRouteRegistry";

class EchoHttpHandler implements HttpHandler {
  async handle(request: HttpRequest): Promise<HttpResponse> {
    return {
      statusCode: 200,
      headers: { "x-echo": "true" },
      body: {
        method: request.method,
        path: request.path,
        body: request.body,
      },
    };
  }
}

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

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const registry = new InMemoryHttpRouteRegistry();
  const route: HttpRoute = {
    method: "POST",
    path: "/echo",
    handler: new EchoHttpHandler(),
  };
  registry.register(route);

  const requestMapper = new DefaultHttpRequestMapper();
  const responseMapper = new DefaultHttpResponseMapper();
  const adapter = new FastifyHttpAdapter(registry, requestMapper, responseMapper);

  const server = new FakeFastifyServer();
  adapter.registerRoutes(server);

  assertEqual(server.registeredRoutes.length, 1, "route registered");
  const registered = server.registeredRoutes[0];
  assertEqual(registered.method, route.method, "method preserved");
  assertEqual(registered.url, route.path, "path/url preserved");

  const fastifyRequest: FastifyLikeRequest = {
    method: "POST",
    url: "/echo",
    headers: { "x-test": "1" },
    query: { q: "1" },
    body: { hello: "world" },
  };
  const reply = new FakeFastifyReply();

  await registered.handler(fastifyRequest, reply);

  assertEqual(reply.statusCode, 200, "status code applied");
  assertEqual(reply.headers["x-echo"], "true", "headers applied");

  const sentBody = reply.sentBody as {
    method: string;
    path: string;
    body: unknown;
  };
  assertEqual(sentBody.method, "POST", "request mapper used (method)");
  assertEqual(sentBody.path, "/echo", "request mapper used (path)");
  assertEqual(
    JSON.stringify(sentBody.body),
    JSON.stringify(fastifyRequest.body),
    "body sent (request mapper preserved body)",
  );

  console.log("Fastify HTTP adapter validation succeeded.");
}

main();
