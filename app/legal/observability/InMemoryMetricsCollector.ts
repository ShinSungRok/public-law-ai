import type { MetricPoint } from "./MetricPoint";
import type { MetricsCollector } from "./MetricsCollector";
import type { MetricType } from "./MetricType";

const DEFAULT_COUNTER_INCREMENT = 1;

export class InMemoryMetricsCollector implements MetricsCollector {
  private readonly points: MetricPoint[] = [];

  incrementCounter(
    name: string,
    value: number = DEFAULT_COUNTER_INCREMENT,
    tags?: Record<string, string>,
  ): void {
    this.record(name, "counter", value, tags);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, "gauge", value, tags);
  }

  recordTimer(name: string, value: number, tags?: Record<string, string>): void {
    this.record(name, "timer", value, tags);
  }

  private record(
    name: string,
    type: MetricType,
    value: number,
    tags?: Record<string, string>,
  ): void {
    this.points.push({
      name,
      type,
      value,
      timestamp: new Date().toISOString(),
      tags,
    });
  }

  getMetrics(): MetricPoint[] {
    return [...this.points];
  }
}
