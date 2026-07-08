import type { HttpRequest } from "./HttpRequest";
import type { RawHttpRequest } from "./RawHttpRequest";

export interface HttpRequestMapper {
  map(request: RawHttpRequest): HttpRequest;
}
