export interface ServerRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
}
