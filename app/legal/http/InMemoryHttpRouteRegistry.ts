import type { HttpRoute } from "./HttpRoute";
import type { HttpRouteRegistry } from "./HttpRouteRegistry";

export class InMemoryHttpRouteRegistry implements HttpRouteRegistry {
  private readonly routes: HttpRoute[] = [];

  register(route: HttpRoute): void {
    this.routes.push(route);
  }

  getRoutes(): HttpRoute[] {
    return [...this.routes];
  }
}
