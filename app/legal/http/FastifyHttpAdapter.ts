import type { FastifyLikeServer } from "./FastifyLikeServer";
import type { HttpRequestMapper } from "./HttpRequestMapper";
import type { HttpResponseMapper } from "./HttpResponseMapper";
import type { HttpRouteRegistry } from "./HttpRouteRegistry";

export class FastifyHttpAdapter {
  constructor(
    private readonly routeRegistry: HttpRouteRegistry,
    private readonly requestMapper: HttpRequestMapper,
    private readonly responseMapper: HttpResponseMapper,
  ) {}

  registerRoutes(server: FastifyLikeServer): void {
    for (const route of this.routeRegistry.getRoutes()) {
      server.route({
        method: route.method,
        url: route.path,
        handler: async (request, reply) => {
          const httpRequest = this.requestMapper.map({
            method: request.method,
            path: request.url,
            headers: request.headers,
            query: request.query,
            body: request.body,
          });

          const httpResponse = await route.handler.handle(httpRequest);
          const rawResponse = this.responseMapper.map(httpResponse);

          reply.status(rawResponse.statusCode);
          for (const [name, value] of Object.entries(rawResponse.headers)) {
            reply.header(name, value);
          }
          reply.send(rawResponse.body);
        },
      });
    }
  }
}
