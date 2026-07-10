import { existsSync } from "node:fs";
import path from "node:path";

const REQUIRED_DOCUMENTATION_FILES = [
  "README.md",
  "docs/architecture.md",
  "docs/modules.md",
  "docs/development.md",
  "docs/deployment.md",
  "docs/portfolio.md",
];

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertDocumentationFilesExist(): void {
  for (const relativePath of REQUIRED_DOCUMENTATION_FILES) {
    console.log(`[docs] Checking ${relativePath} exists...`);
    assertTruthy(
      existsSync(path.resolve(process.cwd(), relativePath)),
      `${relativePath} does not exist`,
    );
  }
}

async function main(): Promise<void> {
  assertDocumentationFilesExist();

  console.log("Documentation validation succeeded.");
}

main();
