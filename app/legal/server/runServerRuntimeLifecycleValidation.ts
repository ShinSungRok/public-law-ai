import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ApplicationBootstrap } from "../composition/ApplicationBootstrap";
import { DefaultApplicationContextFactory } from "../composition/DefaultApplicationContextFactory";
import { ProductionServerRuntime } from "./ProductionServerRuntime";

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
  for (const relativePath of SERVER_RUNTIME_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  const productionServerRuntimeSource = readSource(
    "app/legal/server/ProductionServerRuntime.ts",
  );
  assertTruthy(
    /\bstart\s*\(\s*\)\s*:\s*Promise<void>/.test(productionServerRuntimeSource),
    "ProductionServerRuntime does not expose start(): Promise<void>",
  );
  assertTruthy(
    /\bstop\s*\(\s*\)\s*:\s*Promise<void>/.test(productionServerRuntimeSource),
    "ProductionServerRuntime does not expose stop(): Promise<void>",
  );

  const runProductionServerSource = readSource(
    "app/legal/server/runProductionServer.ts",
  );
  assertTruthy(
    runProductionServerSource.includes("ProductionServerRuntime"),
    "runProductionServer.ts does not use ProductionServerRuntime",
  );

  for (const relativePath of SERVER_RUNTIME_FILES) {
    assertTruthy(
      !readSource(relativePath).includes("process.env"),
      `${relativePath} must not read process.env directly`,
    );
  }

  const bootstrap = new ApplicationBootstrap(new DefaultApplicationContextFactory());
  const runtime = new ProductionServerRuntime(bootstrap);

  await runtime.start();
  const context = runtime.getContext();
  assertTruthy(
    context,
    "ProductionServerRuntime did not produce an ApplicationContext after start()",
  );

  await runtime.start();
  assertTruthy(
    runtime.getContext() === context,
    "ProductionServerRuntime is not idempotent: calling start() twice created a new ApplicationContext",
  );

  await runtime.stop();

  console.log("Server runtime lifecycle validation succeeded.");
}

main();
