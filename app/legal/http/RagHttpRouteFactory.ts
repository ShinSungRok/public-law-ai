import type { RagController } from "../api/RagController";
import type { HttpRoute } from "./HttpRoute";
import { RagHttpHandler } from "./RagHttpHandler";

export function createRagHttpRoute(controller: RagController): HttpRoute {
  return {
    method: "POST",
    path: "/rag/answer",
    handler: new RagHttpHandler(controller),
  };
}
