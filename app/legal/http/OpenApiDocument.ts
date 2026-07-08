import type { OpenApiPathItem } from "./OpenApiPathItem";

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, OpenApiPathItem>;
}
