export interface MetricsCollector {
  incrementCounter(
    name: string,
    value?: number,
    tags?: Record<string, string>,
  ): void;
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
  recordTimer(name: string, value: number, tags?: Record<string, string>): void;
}
