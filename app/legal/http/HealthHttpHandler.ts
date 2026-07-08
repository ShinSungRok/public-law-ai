import type { HealthController } from "../api/HealthController";
import type { HttpHandler } from "./HttpHandler";
import type { HttpResponse } from "./HttpResponse";

export class HealthHttpHandler implements HttpHandler {
  constructor(private readonly healthController: HealthController) {}

  async handle(): Promise<HttpResponse> {
    const status = await this.healthController.check();

    return {
      statusCode: 200,
      headers: {},
      body: status,
    };
  }
}
