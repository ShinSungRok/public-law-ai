import type { FastifyLikeReply } from "./FastifyLikeReply";
import type { FastifyLikeRequest } from "./FastifyLikeRequest";

export interface FastifyLikeRouteOptions {
  method: string;
  url: string;
  handler: (
    request: FastifyLikeRequest,
    reply: FastifyLikeReply,
  ) => Promise<void>;
}
