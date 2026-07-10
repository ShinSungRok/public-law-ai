export interface TimeoutPolicy {
  execute<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T>;
}
