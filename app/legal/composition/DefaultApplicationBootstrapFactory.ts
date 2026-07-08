import { ApplicationBootstrap } from "./ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "./DefaultApplicationContextFactory";

export class DefaultApplicationBootstrapFactory {
  create(): ApplicationBootstrap {
    return new ApplicationBootstrap(new DefaultApplicationContextFactory());
  }
}
