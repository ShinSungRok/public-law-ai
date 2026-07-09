import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

async function main(): Promise<void> {
  const entrypointPath = path.resolve(
    process.cwd(),
    "app/legal/server/runProductionServer.ts",
  );
  assertTruthy(
    existsSync(entrypointPath),
    "app/legal/server/runProductionServer.ts does not exist",
  );

  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  assertTruthy(existsSync(packageJsonPath), "package.json does not exist at project root");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  assertTruthy(
    typeof packageJson.scripts?.["server:start"] === "string",
    "package.json missing required script: server:start",
  );

  const entrypointSource = readFileSync(entrypointPath, "utf8");
  assertTruthy(
    entrypointSource.includes("DefaultApplicationContextFactory"),
    "runProductionServer.ts does not reference DefaultApplicationContextFactory",
  );
  assertTruthy(
    entrypointSource.includes("ApplicationBootstrap"),
    "runProductionServer.ts does not reference ApplicationBootstrap",
  );
  assertTruthy(
    !entrypointSource.includes("process.env"),
    "runProductionServer.ts must not read process.env directly",
  );

  console.log("Production server entrypoint validation succeeded.");
}

main();
