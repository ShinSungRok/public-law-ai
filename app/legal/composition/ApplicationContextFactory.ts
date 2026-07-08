import type { ApplicationContext } from "./ApplicationContext";

export interface ApplicationContextFactory {
  create(): ApplicationContext;
}
