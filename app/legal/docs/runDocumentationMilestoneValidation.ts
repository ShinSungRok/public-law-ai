import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface DocumentationValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: DocumentationValidationStep[] = [
  {
    name: "Documentation",
    scriptPath: "app/legal/docs/runDocumentationValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = ["validate:docs", "validate:portfolio"];

const REQUIRED_DOCUMENTATION_FILES = [
  "README.md",
  "docs/architecture.md",
  "docs/modules.md",
  "docs/development.md",
  "docs/deployment.md",
  "docs/portfolio.md",
];

const SELF_FILES = [
  "app/legal/docs/runDocumentationMilestoneValidation.ts",
  "app/legal/docs/runDocumentationValidation.ts",
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

function assertDocumentationStructureComplete(): void {
  for (const relativePath of REQUIRED_DOCUMENTATION_FILES) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    assertTruthy(existsSync(fullPath), `${relativePath} does not exist`);

    const contents = readFileSync(fullPath, "utf8");
    assertTruthy(
      contents.trim().length > 0,
      `${relativePath} exists but is empty`,
    );
  }
}

async function main(): Promise<void> {
  console.log(
    "[docs] No external services required: this validation only checks file existence and contents on disk.",
  );

  console.log("[docs] Checking every required documentation file exists...");
  assertDocumentationStructureComplete();

  console.log("[docs] Checking milestone runner and validation runner files exist...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[docs] Checking package.json documentation validation scripts...");
  assertPackageJsonScripts();

  for (const step of VALIDATION_STEPS) {
    console.log(`[docs] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[docs] ${step.name} validation passed.`);
  }

  console.log(
    "Documentation milestone validation succeeded — Phase 22 portfolio packaging is complete.",
  );
}

main();
