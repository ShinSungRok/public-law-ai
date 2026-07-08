import type { HttpHandler } from "./HttpHandler";
import type { HttpMethod } from "./HttpMethod";

export interface HttpRoute {
  method: HttpMethod;
  path: string;
  handler: HttpHandler;
}
