export interface FastifyLikeReply {
  status(statusCode: number): FastifyLikeReply;
  header(name: string, value: string): FastifyLikeReply;
  send(body: unknown): void;
}
