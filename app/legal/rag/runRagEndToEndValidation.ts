import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface RagValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: RagValidationStep[] = [
  {
    name: "RagRuntimeFlow",
    scriptPath: "app/legal/rag/runRagRuntimeFlowValidation.ts",
  },
  {
    name: "SearchToRagIntegration",
    scriptPath: "app/legal/rag/runSearchToRagIntegrationValidation.ts",
  },
  {
    name: "RagApiRuntime",
    scriptPath: "app/legal/rag/runRagApiRuntimeValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "validate:rag:runtime-flow",
  "validate:rag:search-integration",
  "validate:rag:api-runtime",
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertPackageJsonScripts(): void {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  assertTruthy(
    existsSync(packageJsonPath),
    "package.json does not exist at project root",
  );

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
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
  console.log("[rag] Checking RAG validation runner files exist...");
  for (const step of VALIDATION_STEPS) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), step.scriptPath)),
      `${step.scriptPath} does not exist`,
    );
  }

  console.log("[rag] Checking package.json RAG validation scripts...");
  assertPackageJsonScripts();

  for (const step of VALIDATION_STEPS) {
    console.log(`[rag] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[rag] ${step.name} validation passed.`);
  }

  console.log("RAG end-to-end validation suite succeeded.");
}

main();
