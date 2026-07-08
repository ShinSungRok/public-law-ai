import type { HttpMethod } from "./HttpMethod";

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}
