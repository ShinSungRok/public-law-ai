import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface EvaluationValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: EvaluationValidationStep[] = [
  {
    name: "EvaluationFramework",
    scriptPath: "app/legal/evaluation/runEvaluationFrameworkValidation.ts",
  },
  {
    name: "RetrievalEvaluation",
    scriptPath: "app/legal/evaluation/runRetrievalEvaluationValidation.ts",
  },
  {
    name: "SearchEvaluation",
    scriptPath: "app/legal/evaluation/runSearchEvaluationValidation.ts",
  },
  {
    name: "RagAnswerEvaluation",
    scriptPath: "app/legal/evaluation/runRagAnswerEvaluationValidation.ts",
  },
  {
    name: "RegressionEvaluation",
    scriptPath: "app/legal/evaluation/runRegressionEvaluationValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "validate:evaluation:framework",
  "validate:evaluation:retrieval",
  "validate:evaluation:search",
  "validate:evaluation:rag",
  "validate:evaluation:regression",
  "validate:evaluation",
];

const SELF_FILES = [
  "app/legal/evaluation/runEvaluationMilestoneValidation.ts",
  "docs/evaluation.md",
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
  console.log("[evaluation] Checking evaluation validation runner files exist...");
  for (const step of VALIDATION_STEPS) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), step.scriptPath)),
      `${step.scriptPath} does not exist`,
    );
  }

  console.log("[evaluation] Checking milestone documentation and self-reference exist...");
  for (const relativePath of SELF_FILES) {
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }

  console.log("[evaluation] Checking package.json evaluation validation scripts...");
  assertPackageJsonScripts();

  for (const step of VALIDATION_STEPS) {
    console.log(`[evaluation] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[evaluation] ${step.name} validation passed.`);
  }

  console.log(
    "Evaluation milestone validation succeeded — Phase 19 evaluation & quality framework is complete.",
  );
}

main();
