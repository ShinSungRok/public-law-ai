import { HealthController } from "../api/HealthController";
import { DefaultApiConfigurationFactory } from "../server/DefaultApiConfigurationFactory";
import { createHealthHttpRoute } from "./HealthHttpRouteFactory";
import type { HttpRequest } from "./HttpRequest";

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main(): Promise<void> {
  const configuration = new DefaultApiConfigurationFactory().create();
  const healthController = new HealthController(configuration);

  const route = createHealthHttpRoute(healthController);

  assertEqual(route.method, "GET", "method mismatch");
  assertEqual(route.path, "/health", "path mismatch");

  const request: HttpRequest = {
    method: "GET",
    path: "/health",
    headers: {},
    query: {},
    body: null,
  };
  const response = await route.handler.handle(request);

  assertEqual(response.statusCode, 200, "statusCode mismatch");

  const body = response.body as { status: string; service: string };
  assertEqual(body.status, "UP", "status field mismatch");
  assertEqual(body.service, configuration.serviceName, "service field mismatch");

  console.log("Health HTTP route validation succeeded.");
}

main();
