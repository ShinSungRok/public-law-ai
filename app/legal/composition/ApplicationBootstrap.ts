import type { ApplicationContext } from "./ApplicationContext";
import type { ApplicationContextFactory } from "./ApplicationContextFactory";

export class ApplicationBootstrap {
  constructor(private readonly contextFactory: ApplicationContextFactory) {}

  bootstrap(): ApplicationContext {
    return this.contextFactory.create();
  }
}
