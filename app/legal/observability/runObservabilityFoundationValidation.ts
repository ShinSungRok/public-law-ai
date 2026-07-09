import { ConsoleLogger } from "./ConsoleLogger";
import { InMemoryLogger } from "./InMemoryLogger";
import { InMemoryMetricsCollector } from "./InMemoryMetricsCollector";
import type { LogEntry } from "./LogEntry";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

function validateLogger(): void {
  console.log("[observability] Checking Logger supports all log levels...");
  const logger = new InMemoryLogger("test-context");
  logger.debug("debug message", { step: 1 });
  logger.info("info message", { step: 2 });
  logger.warn("warn message", { step: 3 });
  logger.error("error message", { step: 4 });

  const entries = logger.getEntries();
  assertEqual(entries.length, 4, "expected exactly four log entries");

  console.log("[observability] Checking InMemoryLogger stores structured logs...");
  const levels = entries.map((entry) => entry.level);
  assertEqual(
    JSON.stringify(levels),
    JSON.stringify(["debug", "info", "warn", "error"]),
    "log levels should be recorded in call order",
  );

  for (const entry of entries) {
    assertTruthy(entry.message.length > 0, "log entry missing message");
    assertTruthy(isIsoTimestamp(entry.timestamp), "log entry timestamp is not a valid date");
    assertEqual(entry.context, "test-context", "log entry context mismatch");
    assertTruthy(entry.metadata, "log entry missing metadata");
  }

  const infoEntry = entries.find((entry) => entry.level === "info") as LogEntry;
  assertEqual(infoEntry.message, "info message", "info entry message mismatch");
  assertEqual(infoEntry.metadata?.step, 2, "info entry metadata mismatch");
}

function validateConsoleLogger(): void {
  console.log(
    "[observability] Checking ConsoleLogger can be constructed without external dependencies...",
  );
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  const captured: { level: string; output: string }[] = [];

  console.debug = (output: string) => captured.push({ level: "debug", output });
  console.info = (output: string) => captured.push({ level: "info", output });
  console.warn = (output: string) => captured.push({ level: "warn", output });
  console.error = (output: string) => captured.push({ level: "error", output });

  try {
    const consoleLogger = new ConsoleLogger("console-context");
    consoleLogger.debug("console debug", { a: 1 });
    consoleLogger.info("console info", { a: 2 });
    consoleLogger.warn("console warn", { a: 3 });
    consoleLogger.error("console error", { a: 4 });
  } finally {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  }

  assertEqual(captured.length, 4, "expected ConsoleLogger to write four entries");
  for (const { level, output } of captured) {
    const parsed = JSON.parse(output) as LogEntry;
    assertEqual(parsed.level, level, "console log entry level mismatch");
    assertEqual(parsed.context, "console-context", "console log entry context mismatch");
    assertTruthy(isIsoTimestamp(parsed.timestamp), "console log entry timestamp is invalid");
  }
}

function validateMetricsCollector(): void {
  console.log("[observability] Checking MetricsCollector records counter metrics...");
  const metrics = new InMemoryMetricsCollector();
  metrics.incrementCounter("rag.answer.requests");
  metrics.incrementCounter("rag.answer.requests", 3, { provider: "fake" });

  console.log("[observability] Checking MetricsCollector records gauge metrics...");
  metrics.setGauge("rag.answer.queue-depth", 5, { provider: "fake" });

  console.log("[observability] Checking MetricsCollector records timer metrics...");
  metrics.recordTimer("rag.answer.duration-ms", 42, { provider: "fake" });

  const points = metrics.getMetrics();
  assertEqual(points.length, 4, "expected exactly four recorded metric points");

  console.log(
    "[observability] Checking collected metrics include expected names, values, types, timestamps, and tags...",
  );
  const [firstCounter, secondCounter, gauge, timer] = points;

  assertEqual(firstCounter.name, "rag.answer.requests", "first counter name mismatch");
  assertEqual(firstCounter.type, "counter", "first counter type mismatch");
  assertEqual(firstCounter.value, 1, "first counter should default to +1");
  assertTruthy(isIsoTimestamp(firstCounter.timestamp), "first counter timestamp is invalid");

  assertEqual(secondCounter.value, 3, "second counter explicit value mismatch");
  assertEqual(secondCounter.tags?.provider, "fake", "second counter tags mismatch");

  assertEqual(gauge.type, "gauge", "gauge type mismatch");
  assertEqual(gauge.value, 5, "gauge value mismatch");
  assertEqual(gauge.tags?.provider, "fake", "gauge tags mismatch");

  assertEqual(timer.type, "timer", "timer type mismatch");
  assertEqual(timer.value, 42, "timer value mismatch");
  assertEqual(timer.tags?.provider, "fake", "timer tags mismatch");
}

async function main(): Promise<void> {
  validateLogger();
  validateConsoleLogger();
  validateMetricsCollector();

  console.log("Observability foundation validation succeeded.");
}

main();
