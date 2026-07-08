import type { HttpRoute } from "./HttpRoute";

export interface HttpRouteRegistry {
  register(route: HttpRoute): void;
  getRoutes(): HttpRoute[];
}
