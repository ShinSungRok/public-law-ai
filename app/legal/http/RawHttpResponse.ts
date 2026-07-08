export interface RawHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
}
