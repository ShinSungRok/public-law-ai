import type { HttpHandler } from "./HttpHandler";
import type { HttpRequest } from "./HttpRequest";
import type { HttpResponse } from "./HttpResponse";

class FakeHttpHandler implements HttpHandler {
  async handle(request: HttpRequest): Promise<HttpResponse> {
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: { echoedPath: request.path, echoedMethod: request.method },
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
  const handler: HttpHandler = new FakeHttpHandler();

  const request: HttpRequest = {
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    body: null,
  };

  const response = await handler.handle(request);

  assertEqual(response.statusCode, 200, "statusCode mismatch");
  assertEqual(
    response.headers["content-type"],
    "application/json",
    "content-type header mismatch",
  );

  const responseBody = response.body as {
    echoedPath: string;
    echoedMethod: string;
  };
  assertEqual(responseBody.echoedPath, request.path, "echoedPath mismatch");
  assertEqual(
    responseBody.echoedMethod,
    request.method,
    "echoedMethod mismatch",
  );

  console.log("HTTP abstraction validation succeeded.");
}

main();
