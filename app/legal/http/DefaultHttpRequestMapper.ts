import type { HttpMethod } from "./HttpMethod";
import type { HttpRequest } from "./HttpRequest";
import type { HttpRequestMapper } from "./HttpRequestMapper";
import type { RawHttpRequest } from "./RawHttpRequest";
import { UnsupportedHttpMethodError } from "./UnsupportedHttpMethodError";

const SUPPORTED_METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

function toHttpMethod(method: string): HttpMethod {
  const normalized = method.toUpperCase();
  const matched = SUPPORTED_METHODS.find(
    (supported) => supported === normalized,
  );

  if (!matched) {
    throw new UnsupportedHttpMethodError(method);
  }

  return matched;
}

export class DefaultHttpRequestMapper implements HttpRequestMapper {
  map(request: RawHttpRequest): HttpRequest {
    return {
      method: toHttpMethod(request.method),
      path: request.path,
      headers: request.headers,
      query: request.query,
      body: request.body,
    };
  }
}
