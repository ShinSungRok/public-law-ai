import type { HttpRoute } from "./HttpRoute";
import type { OpenApiDocument } from "./OpenApiDocument";
import type { OpenApiOperation } from "./OpenApiOperation";
import type { OpenApiPathItem } from "./OpenApiPathItem";

const OPENAPI_VERSION = "3.0.0";
const DEFAULT_TITLE = "public-law-ai API";
const DEFAULT_VERSION = "0.1.0";

type OpenApiMethodKey = keyof OpenApiPathItem;

function toMethodKey(method: HttpRoute["method"]): OpenApiMethodKey {
  return method.toLowerCase() as OpenApiMethodKey;
}

function toOperationId(route: HttpRoute): string {
  const sanitizedPath = route.path
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("_");
  return `${route.method.toLowerCase()}_${sanitizedPath}`;
}

function toOperation(route: HttpRoute): OpenApiOperation {
  return {
    operationId: toOperationId(route),
    responses: {
      "200": { description: "Successful response" },
    },
  };
}

export class OpenApiGenerator {
  generate(routes: HttpRoute[]): OpenApiDocument {
    const paths: Record<string, OpenApiPathItem> = {};

    for (const route of routes) {
      const pathItem = paths[route.path] ?? {};
      pathItem[toMethodKey(route.method)] = toOperation(route);
      paths[route.path] = pathItem;
    }

    return {
      openapi: OPENAPI_VERSION,
      info: {
        title: DEFAULT_TITLE,
        version: DEFAULT_VERSION,
      },
      paths,
    };
  }
}
