export interface FastifyLikeRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}
