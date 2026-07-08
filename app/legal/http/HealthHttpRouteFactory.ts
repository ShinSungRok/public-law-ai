import type { HealthController } from "../api/HealthController";
import { HealthHttpHandler } from "./HealthHttpHandler";
import type { HttpRoute } from "./HttpRoute";

export function createHealthHttpRoute(controller: HealthController): HttpRoute {
  return {
    method: "GET",
    path: "/health",
    handler: new HealthHttpHandler(controller),
  };
}
