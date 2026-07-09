import { execFileSync } from "node:child_process";
import path from "node:path";

interface ConfigValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: ConfigValidationStep[] = [
  {
    name: "ApplicationConfigurationContract",
    scriptPath: "app/legal/config/runApplicationConfigurationValidation.ts",
  },
  {
    name: "EnvironmentApplicationConfigurationFactory",
    scriptPath:
      "app/legal/config/runEnvironmentApplicationConfigurationFactoryValidation.ts",
  },
  {
    name: "ApplicationConfigurationValidator",
    scriptPath: "app/legal/config/runApplicationConfigurationValidatorValidation.ts",
  },
];

async function main(): Promise<void> {
  for (const step of VALIDATION_STEPS) {
    console.log(`[config] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[config] ${step.name} validation passed.`);
  }

  console.log("Config milestone validation succeeded.");
}

main();
