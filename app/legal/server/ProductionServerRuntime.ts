import type { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import type { ApplicationContext } from "../composition/ApplicationContext";
import type { ServerRuntime } from "./ServerRuntime";

export class ProductionServerRuntime implements ServerRuntime {
  private context: ApplicationContext | undefined;

  constructor(private readonly bootstrap: ApplicationBootstrap) {}

  async start(): Promise<void> {
    if (this.context) {
      return;
    }
    this.context = this.bootstrap.bootstrap();
  }

  async stop(): Promise<void> {
    // No-op for now: this phase only introduces the lifecycle contract.
  }

  getContext(): ApplicationContext {
    if (!this.context) {
      throw new Error("ProductionServerRuntime has not been started");
    }
    return this.context;
  }
}
