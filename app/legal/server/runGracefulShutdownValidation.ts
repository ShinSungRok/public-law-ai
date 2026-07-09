import { readFileSync } from "node:fs";
import path from "node:path";

const SERVER_RUNTIME_FILES = [
  "app/legal/server/ServerRuntime.ts",
  "app/legal/server/ProductionServerRuntime.ts",
  "app/legal/server/runProductionServer.ts",
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const runProductionServerSource = readSource(
    "app/legal/server/runProductionServer.ts",
  );

  assertTruthy(
    runProductionServerSource.includes("SIGINT"),
    "runProductionServer.ts does not register a SIGINT handler",
  );
  assertTruthy(
    runProductionServerSource.includes("SIGTERM"),
    "runProductionServer.ts does not register a SIGTERM handler",
  );
  assertTruthy(
    /runtime\.stop\s*\(/.test(runProductionServerSource),
    "runProductionServer.ts does not call runtime.stop()",
  );

  for (const relativePath of SERVER_RUNTIME_FILES) {
    assertTruthy(
      !readSource(relativePath).includes("process.env"),
      `${relativePath} must not read process.env directly`,
    );
  }

  console.log("Graceful shutdown validation succeeded.");
}

main();
