import type { ApiRouter } from "./ApiRouter";
import type { ApiServer } from "./ApiServer";

export class FakeApiServer implements ApiServer {
  private running = false;

  constructor(private readonly router: ApiRouter) {}

  async start(): Promise<void> {
    await this.router.register();
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }
}
