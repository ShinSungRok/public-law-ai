import { execFileSync } from "node:child_process";
import path from "node:path";

interface AiValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: AiValidationStep[] = [
  {
    name: "AiProviderContract",
    scriptPath: "app/legal/ai/runAiProviderContractValidation.ts",
  },
  {
    name: "AiProviderFactory",
    scriptPath: "app/legal/ai/runAiProviderFactoryValidation.ts",
  },
  {
    name: "AiPromptExecutor",
    scriptPath: "app/legal/ai/runAiPromptExecutorValidation.ts",
  },
  {
    name: "LlmConfiguration",
    scriptPath: "app/legal/ai/runLlmConfigurationValidation.ts",
  },
  {
    name: "LlmConfigurationFactory",
    scriptPath: "app/legal/ai/runLlmConfigurationFactoryValidation.ts",
  },
  {
    name: "OpenAiProvider",
    scriptPath: "app/legal/ai/runOpenAiProviderValidation.ts",
  },
  {
    name: "AnthropicProvider",
    scriptPath: "app/legal/ai/runAnthropicProviderValidation.ts",
  },
  {
    name: "RealLlmProviderFactory",
    scriptPath: "app/legal/ai/runRealLlmProviderFactoryValidation.ts",
  },
];

async function main(): Promise<void> {
  for (const step of VALIDATION_STEPS) {
    console.log(`[ai] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[ai] ${step.name} validation passed.`);
  }

  console.log("AI milestone validation succeeded.");
}

main();
