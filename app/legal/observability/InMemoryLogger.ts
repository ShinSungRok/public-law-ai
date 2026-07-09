import type { LogEntry } from "./LogEntry";
import type { Logger } from "./Logger";
import type { LogLevel } from "./LogLevel";

export class InMemoryLogger implements Logger {
  private readonly entries: LogEntry[] = [];

  constructor(private readonly context?: string) {}

  private record(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.entries.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context,
      metadata,
    });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.record("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.record("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.record("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.record("error", message, metadata);
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }
}
