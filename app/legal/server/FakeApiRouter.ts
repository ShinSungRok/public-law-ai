import type { HealthController } from "../api/HealthController";
import type { RagController } from "../api/RagController";
import type { ApiRouter } from "./ApiRouter";

export class FakeApiRouter implements ApiRouter {
  private registered = false;

  constructor(
    private readonly ragController: RagController,
    private readonly healthController: HealthController,
  ) {}

  async register(): Promise<void> {
    this.registered = true;
  }

  isRegistered(): boolean {
    return this.registered;
  }
}
