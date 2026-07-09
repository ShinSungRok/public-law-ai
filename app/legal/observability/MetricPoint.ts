import type { MetricType } from "./MetricType";

export interface MetricPoint {
  name: string;
  type: MetricType;
  value: number;
  timestamp: string;
  tags?: Record<string, string>;
}
