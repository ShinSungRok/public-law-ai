import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import type { FastifyLikeReply } from "./FastifyLikeReply";
import type { FastifyLikeRequest } from "./FastifyLikeRequest";
import type { FastifyLikeRouteOptions } from "./FastifyLikeRouteOptions";
import type { FastifyLikeServer } from "./FastifyLikeServer";

class NodeHttpReply implements FastifyLikeReply {
  private statusCode = 200;
  private readonly headers: Record<string, string> = {};

  constructor(private readonly response: ServerResponse) {}

  status(statusCode: number): FastifyLikeReply {
    this.statusCode = statusCode;
    return this;
  }

  header(name: string, value: string): FastifyLikeReply {
    this.headers[name] = value;
    return this;
  }

  send(body: unknown): void {
    const isString = typeof body === "string";
    const hasContentType = Object.keys(this.headers).some(
      (name) => name.toLowerCase() === "content-type",
    );

    if (!hasContentType) {
      this.headers["Content-Type"] = isString
        ? "text/plain; charset=utf-8"
        : "application/json";
    }

    this.response.writeHead(this.statusCode, this.headers);
    this.response.end(isString ? body : JSON.stringify(body));
  }
}

function flattenHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const flattened: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      flattened[name] = value.join(", ");
    } else if (value !== undefined) {
      flattened[name] = value;
    }
  }

  return flattened;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    request.on("end", () => resolve(raw));
    request.on("error", reject);
  });
}

function parseRequestBody(raw: string, contentType: string | undefined): unknown {
  if (!raw) {
    return undefined;
  }
  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * Real, socket-listening implementation of FastifyLikeServer using only
 * Node's built-in http module — no fastify dependency required. Route
 * matching is a simple method+exact-path lookup, sufficient for this
 * project's fixed route set (no path params).
 */
export class NodeHttpFastifyLikeServer implements FastifyLikeServer {
  private readonly routes: FastifyLikeRouteOptions[] = [];
  private httpServer: Server | undefined;

  route(options: FastifyLikeRouteOptions): void {
    this.routes.push(options);
  }

  async listen(host: string, port: number): Promise<void> {
    const server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => resolve());
    });

    this.httpServer = server;
  }

  getPort(): number {
    const address = this.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("NodeHttpFastifyLikeServer is not listening");
    }
    return address.port;
  }

  async close(): Promise<void> {
    const server = this.httpServer;
    if (!server) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    this.httpServer = undefined;
  }

  private async handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = (request.method ?? "GET").toUpperCase();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    const matched = this.routes.find(
      (route) => route.method.toUpperCase() === method && route.url === url.pathname,
    );

    if (!matched) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    try {
      const rawBody = await readRequestBody(request);
      const body = parseRequestBody(rawBody, request.headers["content-type"]);

      const query: Record<string, string> = {};
      for (const [key, value] of url.searchParams.entries()) {
        query[key] = value;
      }

      const fastifyRequest: FastifyLikeRequest = {
        method,
        url: url.pathname,
        headers: flattenHeaders(request.headers),
        query,
        body,
      };

      await matched.handler(fastifyRequest, new NodeHttpReply(response));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Internal Server Error" }));
      console.error(error);
    }
  }
}
