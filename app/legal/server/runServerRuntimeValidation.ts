import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface ServerValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: ServerValidationStep[] = [
  {
    name: "ProductionServerEntrypoint",
    scriptPath: "app/legal/server/runProductionServerEntrypointValidation.ts",
  },
  {
    name: "ServerRuntimeLifecycle",
    scriptPath: "app/legal/server/runServerRuntimeLifecycleValidation.ts",
  },
  {
    name: "GracefulShutdown",
    scriptPath: "app/legal/server/runGracefulShutdownValidation.ts",
  },
];

const SERVER_RUNTIME_FILES = [
  "app/legal/server/ServerRuntime.ts",
  "app/legal/server/ProductionServerRuntime.ts",
  "app/legal/server/runProductionServer.ts",
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "server:start",
  "validate:server:entrypoint",
  "validate:server:lifecycle",
  "validate:server:shutdown",
  "validate:server",
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function readSource(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function assertPackageJsonScripts(): void {
  const packageJson = JSON.parse(readSource("package.json")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};

  for (const scriptName of REQUIRED_PACKAGE_JSON_SCRIPTS) {
    assertTruthy(
      typeof scripts[scriptName] === "string",
      `package.json missing required script: ${scriptName}`,
    );
  }
}

async function main(): Promise<void> {
  for (const step of VALIDATION_STEPS) {
    console.log(`[server] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[server] ${step.name} validation passed.`);
  }

  console.log("[server] Checking server package.json scripts...");
  assertPackageJsonScripts();

  const runProductionServerSource = readSource(
    "app/legal/server/runProductionServer.ts",
  );
  assertTruthy(
    runProductionServerSource.includes("ProductionServerRuntime"),
    "runProductionServer.ts does not use ProductionServerRuntime",
  );

  const productionServerRuntimeSource = readSource(
    "app/legal/server/ProductionServerRuntime.ts",
  );
  assertTruthy(
    productionServerRuntimeSource.includes("ApplicationBootstrap"),
    "ProductionServerRuntime does not use ApplicationBootstrap",
  );

  assertTruthy(
    runProductionServerSource.includes("applicationConfiguration"),
    "runProductionServer.ts does not use the validated ApplicationConfiguration",
  );

  console.log("[server] Checking docs/server-runtime.md exists...");
  assertTruthy(
    existsSync(path.resolve(process.cwd(), "docs/server-runtime.md")),
    "docs/server-runtime.md does not exist",
  );

  console.log("[server] Checking for direct process.env access...");
  for (const relativePath of SERVER_RUNTIME_FILES) {
    assertTruthy(
      !readSource(relativePath).includes("process.env"),
      `${relativePath} must not read process.env directly`,
    );
  }

  console.log("Server runtime validation succeeded.");
}

main();
