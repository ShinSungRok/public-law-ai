import { execFileSync } from "node:child_process";
import path from "node:path";

interface CompositionValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: CompositionValidationStep[] = [
  {
    name: "ApplicationContext",
    scriptPath: "app/legal/composition/runApplicationContextValidation.ts",
  },
  {
    name: "ApplicationContextFactory",
    scriptPath:
      "app/legal/composition/runApplicationContextFactoryValidation.ts",
  },
  {
    name: "ApplicationBootstrap",
    scriptPath: "app/legal/composition/runApplicationBootstrapValidation.ts",
  },
  {
    name: "ApplicationRuntime",
    scriptPath: "app/legal/composition/runApplicationRuntimeValidation.ts",
  },
  {
    name: "ApplicationContextAiProvider",
    scriptPath:
      "app/legal/composition/runApplicationContextAiProviderValidation.ts",
  },
  {
    name: "ApplicationContextAiPromptExecutor",
    scriptPath:
      "app/legal/composition/runApplicationContextAiPromptExecutorValidation.ts",
  },
  {
    name: "AiRuntime",
    scriptPath: "app/legal/composition/runAiRuntimeValidation.ts",
  },
  {
    name: "ApplicationContextLlmConfiguration",
    scriptPath:
      "app/legal/composition/runApplicationContextLlmConfigurationValidation.ts",
  },
  {
    name: "LlmRuntime",
    scriptPath: "app/legal/composition/runLlmRuntimeValidation.ts",
  },
];

async function main(): Promise<void> {
  for (const step of VALIDATION_STEPS) {
    console.log(`[composition] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[composition] ${step.name} validation passed.`);
  }

  console.log("Composition milestone validation succeeded.");
}

main();
