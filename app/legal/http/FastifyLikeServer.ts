import type { FastifyLikeRouteOptions } from "./FastifyLikeRouteOptions";

export interface FastifyLikeServer {
  route(options: FastifyLikeRouteOptions): void;
}
