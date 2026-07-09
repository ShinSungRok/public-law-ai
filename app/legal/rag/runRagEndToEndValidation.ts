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
  "validate:rag:e2e",
];

const SELF_FILES = [
  "app/legal/rag/runRagEndToEndValidation.ts",
  "docs/rag-runtime.md",
];

const FORBIDDEN_EXTERNAL_SERVICE_REFERENCES = [
  "@opensearch-project/opensearch",
  "OpenSearchSearchEngine",
  "OpenAiProvider",
  "AnthropicProvider",
  "from \"pg\"",
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

  console.log("[rag] Checking milestone documentation and self-reference exist...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[rag] Checking package.json RAG validation scripts...");
  assertPackageJsonScripts();

  console.log(
    "[rag] Checking RAG API runtime validation uses ApplicationBootstrap/ApplicationContext...",
  );
  const ragApiRuntimeSource = readSource(
    "app/legal/rag/runRagApiRuntimeValidation.ts",
  );
  assertTruthy(
    ragApiRuntimeSource.includes("ApplicationBootstrap"),
    "runRagApiRuntimeValidation.ts does not use ApplicationBootstrap",
  );
  assertTruthy(
    ragApiRuntimeSource.includes("DefaultApplicationContextFactory"),
    "runRagApiRuntimeValidation.ts does not use DefaultApplicationContextFactory",
  );

  console.log(
    "[rag] Checking RAG validation runners require no real external services...",
  );
  for (const step of VALIDATION_STEPS) {
    const source = readSource(step.scriptPath);
    for (const forbiddenReference of FORBIDDEN_EXTERNAL_SERVICE_REFERENCES) {
      assertTruthy(
        !source.includes(forbiddenReference),
        `${step.scriptPath} references a real external service dependency: ${forbiddenReference}`,
      );
    }
  }

  for (const step of VALIDATION_STEPS) {
    console.log(`[rag] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[rag] ${step.name} validation passed.`);
  }

  console.log("RAG end-to-end validation suite succeeded.");
}

main();
