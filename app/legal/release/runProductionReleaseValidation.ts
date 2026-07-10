import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface ReleaseValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: ReleaseValidationStep[] = [
  { name: "Config", scriptPath: "app/legal/config/runConfigMilestoneValidation.ts" },
  { name: "Infra", scriptPath: "app/legal/infra/runInfraMilestoneValidation.ts" },
  { name: "Server", scriptPath: "app/legal/server/runServerRuntimeValidation.ts" },
  { name: "RagEndToEnd", scriptPath: "app/legal/rag/runRagEndToEndValidation.ts" },
  { name: "Evaluation", scriptPath: "app/legal/evaluation/runEvaluationMilestoneValidation.ts" },
  { name: "Observability", scriptPath: "app/legal/observability/runObservabilityMilestoneValidation.ts" },
  {
    name: "SecurityReliability",
    scriptPath: "app/legal/reliability/runSecurityReliabilityMilestoneValidation.ts",
  },
  { name: "Portfolio", scriptPath: "app/legal/docs/runDocumentationMilestoneValidation.ts" },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "validate:config",
  "validate:infra",
  "validate:server",
  "validate:rag:e2e",
  "validate:evaluation",
  "validate:observability",
  "validate:security-reliability",
  "validate:portfolio",
  "validate:release",
];

const REQUIRED_DOCUMENTATION_FILES = [
  "README.md",
  "docs/architecture.md",
  "docs/modules.md",
  "docs/development.md",
  "docs/deployment.md",
  "docs/portfolio.md",
  "docs/release.md",
];

const SELF_FILES = ["app/legal/release/runProductionReleaseValidation.ts"];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertRequiredDocumentationExists(): void {
  for (const relativePath of REQUIRED_DOCUMENTATION_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }
}

function assertMilestoneScriptFilesExist(): void {
  for (const step of VALIDATION_STEPS) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), step.scriptPath)),
      `${step.scriptPath} does not exist`,
    );
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
  console.log(
    "[release] No external services required: PostgreSQL, OpenSearch, Docker, OpenAI, Anthropic, and Redis are not used — every step below runs against fakes/in-memory implementations only.",
  );

  console.log("[release] Checking required project documentation exists...");
  assertRequiredDocumentationExists();

  console.log("[release] Checking this validation runner exists...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[release] Checking required Phase milestone validation scripts exist on disk...");
  assertMilestoneScriptFilesExist();

  console.log("[release] Checking package.json contains the final validation scripts...");
  assertPackageJsonScripts();

  for (const step of VALIDATION_STEPS) {
    console.log(`[release] Running ${step.name} milestone validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[release] ${step.name} milestone validation passed.`);
  }

  console.log(
    "AI Legal Platform production release validation succeeded — the project is release-ready.",
  );
}

main();
