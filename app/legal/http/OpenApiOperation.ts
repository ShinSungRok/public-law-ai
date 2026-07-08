export interface OpenApiOperation {
  operationId: string;
  responses: Record<string, { description: string }>;
}
