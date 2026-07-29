import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface InfraValidationStep {
  name: string;
  scriptPath: string;
}

const TSX_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");

const VALIDATION_STEPS: InfraValidationStep[] = [
  {
    name: "LocalInfrastructure",
    scriptPath: "app/legal/infra/runLocalInfrastructureValidation.ts",
  },
];

const REQUIRED_PACKAGE_JSON_SCRIPTS = [
  "infra:config",
  "infra:up",
  "infra:down",
  "infra:logs",
  "infra:ps",
  "validate:infra:local",
];

const KNOWN_APPLICATION_SERVICE_NAMES = [
  "app",
  "web",
  "server",
  "next",
  "nextjs",
  "public-ai-platform",
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
      `package.json missing required infra lifecycle script: ${scriptName}`,
    );
  }
}

function assertDockerfileArtifacts(): void {
  assertTruthy(
    existsSync(path.resolve(process.cwd(), "Dockerfile")),
    "Dockerfile does not exist at project root",
  );
  assertTruthy(
    existsSync(path.resolve(process.cwd(), ".dockerignore")),
    ".dockerignore does not exist at project root",
  );
}

function assertInfrastructureDocs(): void {
  const docsPath = path.resolve(process.cwd(), "docs/infrastructure.md");
  assertTruthy(existsSync(docsPath), "docs/infrastructure.md does not exist");

  const docs = readFileSync(docsPath, "utf8");
  assertTruthy(
    /docker-compose\.yml/.test(docs),
    "docs/infrastructure.md does not document docker-compose.yml",
  );
  assertTruthy(
    /Dockerfile/.test(docs),
    "docs/infrastructure.md does not document the Dockerfile",
  );
}

function assertApplicationServiceWired(): void {
  const composeFilePath = path.resolve(process.cwd(), "docker-compose.yml");
  assertTruthy(
    existsSync(composeFilePath),
    "docker-compose.yml does not exist at project root",
  );

  const lines = readFileSync(composeFilePath, "utf8").split("\n");
  const servicesStart = lines.findIndex((line) => line.trim() === "services:");
  assertTruthy(
    servicesStart !== -1,
    "docker-compose.yml missing top-level services section",
  );

  let servicesEnd = lines.length;
  for (let i = servicesStart + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().length === 0) {
      continue;
    }
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      servicesEnd = i;
      break;
    }
  }

  const services: { name: string; startLine: number }[] = [];
  for (let i = servicesStart + 1; i < servicesEnd; i += 1) {
    const line = lines[i];
    const indent = line.length - line.trimStart().length;
    if (indent === 2) {
      const match = line.trim().match(/^([A-Za-z0-9_.-]+):/);
      if (match) {
        services.push({ name: match[1], startLine: i });
      }
    }
  }

  const applicationServices = services.filter((service) =>
    KNOWN_APPLICATION_SERVICE_NAMES.includes(service.name),
  );
  assertTruthy(
    applicationServices.length === 1,
    "docker-compose.yml must wire exactly one application service " +
      `(expected one of: ${KNOWN_APPLICATION_SERVICE_NAMES.join(", ")})`,
  );

  const appService = applicationServices[0];
  const appServiceIndex = services.findIndex(
    (service) => service.name === appService.name,
  );
  const blockEnd =
    appServiceIndex + 1 < services.length
      ? services[appServiceIndex + 1].startLine
      : servicesEnd;
  const blockText = lines.slice(appService.startLine, blockEnd).join("\n");

  assertTruthy(
    /build:/.test(blockText) && /Dockerfile/.test(blockText),
    `docker-compose.yml service "${appService.name}" must build from the project Dockerfile`,
  );
  assertTruthy(
    /ports:/.test(blockText),
    `docker-compose.yml service "${appService.name}" must publish a port`,
  );
  assertTruthy(
    /depends_on:/.test(blockText),
    `docker-compose.yml service "${appService.name}" must declare depends_on for its infrastructure dependencies`,
  );
}

async function main(): Promise<void> {
  for (const step of VALIDATION_STEPS) {
    console.log(`[infra] Running ${step.name} validation...`);
    execFileSync(TSX_BIN, [step.scriptPath], { stdio: "inherit" });
    console.log(`[infra] ${step.name} validation passed.`);
  }

  console.log("[infra] Checking package.json infra lifecycle scripts...");
  assertPackageJsonScripts();

  console.log("[infra] Checking Dockerfile and .dockerignore...");
  assertDockerfileArtifacts();

  console.log("[infra] Checking docs/infrastructure.md...");
  assertInfrastructureDocs();

  console.log(
    "[infra] Checking docker-compose.yml wires the application service...",
  );
  assertApplicationServiceWired();

  console.log("Infra milestone validation succeeded.");
}

main();
