import type { LogEntry } from "./LogEntry";
import type { Logger } from "./Logger";
import type { LogLevel } from "./LogLevel";

function buildEntry(
  level: LogLevel,
  message: string,
  context: string | undefined,
  metadata: Record<string, unknown> | undefined,
): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    metadata,
  };
}

export class ConsoleLogger implements Logger {
  constructor(private readonly context?: string) {}

  private write(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    const serialized = JSON.stringify(
      buildEntry(level, message, this.context, metadata),
    );

    switch (level) {
      case "debug":
        console.debug(serialized);
        break;
      case "info":
        console.info(serialized);
        break;
      case "warn":
        console.warn(serialized);
        break;
      case "error":
        console.error(serialized);
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write("warn", message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.write("error", message, metadata);
  }
}
