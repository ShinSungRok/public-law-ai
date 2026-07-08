import type { HttpRequest } from "./HttpRequest";
import type { HttpResponse } from "./HttpResponse";

export interface HttpHandler {
  handle(request: HttpRequest): Promise<HttpResponse>;
}
