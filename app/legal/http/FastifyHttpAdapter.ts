import type { FastifyLikeServer } from "./FastifyLikeServer";
import type { HttpRequestMapper } from "./HttpRequestMapper";
import type { HttpResponseMapper } from "./HttpResponseMapper";
import type { HttpRouteRegistry } from "./HttpRouteRegistry";
import type { ObservabilityService } from "../observability/ObservabilityService";
import type { SecurityReliabilityService } from "../reliability/SecurityReliabilityService";

function resolveClientKey(headers: Record<string, string>): string {
  return headers["x-forwarded-for"] ?? headers["x-real-ip"] ?? "anonymous";
}

export class FastifyHttpAdapter {
  constructor(
    private readonly routeRegistry: HttpRouteRegistry,
    private readonly requestMapper: HttpRequestMapper,
    private readonly responseMapper: HttpResponseMapper,
    private readonly observability?: ObservabilityService,
    private readonly securityReliability?: SecurityReliabilityService,
  ) {}

  registerRoutes(server: FastifyLikeServer): void {
    for (const route of this.routeRegistry.getRoutes()) {
      server.route({
        method: route.method,
        url: route.path,
        handler: async (request, reply) => {
          const startedAt = Date.now();
          const metricTags = { method: route.method, path: route.path };

          if (this.securityReliability) {
            const rateLimitResult = this.securityReliability.rateLimiter.consume(
              resolveClientKey(request.headers),
            );
            if (!rateLimitResult.allowed) {
              this.observability?.metricsCollector.incrementCounter(
                "http.request.rate_limited",
                1,
                metricTags,
              );
              reply.status(429);
              reply.header("Content-Type", "application/json");
              reply.send({ error: "Too many requests" });
              return;
            }

            if (request.body !== undefined && request.body !== null) {
              const bodyText =
                typeof request.body === "string"
                  ? request.body
                  : JSON.stringify(request.body);
              const inputResult = this.securityReliability.inputValidator.validate(bodyText);
              if (!inputResult.valid) {
                this.observability?.metricsCollector.incrementCounter(
                  "http.request.rejected",
                  1,
                  metricTags,
                );
                reply.status(400);
                reply.header("Content-Type", "application/json");
                reply.send({ error: "Invalid request", details: inputResult.errors });
                return;
              }
            }
          }

          try {
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

            const durationMs = Date.now() - startedAt;
            this.observability?.metricsCollector.recordTimer(
              "http.request.duration_ms",
              durationMs,
              { ...metricTags, status: String(rawResponse.statusCode) },
            );
            this.observability?.metricsCollector.incrementCounter(
              "http.request.total",
              1,
              { ...metricTags, status: String(rawResponse.statusCode) },
            );
            this.observability?.logger.info(`${route.method} ${route.path}`, {
              statusCode: rawResponse.statusCode,
              durationMs,
            });
          } catch (error) {
            this.observability?.logger.error(`${route.method} ${route.path} failed`, {
              error: error instanceof Error ? error.message : String(error),
            });
            this.observability?.metricsCollector.incrementCounter(
              "http.request.error",
              1,
              metricTags,
            );
            throw error;
          }
        },
      });
    }
  }
}
