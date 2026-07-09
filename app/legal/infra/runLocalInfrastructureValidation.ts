import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

interface LineSection {
  start: number;
  end: number;
}

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function findTopLevelSection(lines: string[], key: string): LineSection | null {
  const start = lines.findIndex(
    (line) => getIndent(line) === 0 && line.trim() === `${key}:`,
  );
  if (start === -1) {
    return null;
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim().length === 0) {
      continue;
    }
    if (getIndent(line) === 0) {
      end = i;
      break;
    }
  }

  return { start, end };
}

function requireSection(section: LineSection | null, message: string): LineSection {
  if (!section) {
    throw new Error(message);
  }
  return section;
}

function findEntryNames(
  lines: string[],
  section: LineSection,
  indent: number,
): string[] {
  const names: string[] = [];
  for (let i = section.start + 1; i < section.end; i += 1) {
    const line = lines[i];
    if (line.trim().length === 0) {
      continue;
    }
    if (getIndent(line) === indent) {
      const match = line.trim().match(/^([A-Za-z0-9_.-]+):/);
      if (match) {
        names.push(match[1]);
      }
    }
  }
  return names;
}

function extractServiceBlock(
  lines: string[],
  servicesSection: LineSection,
  serviceName: string,
): string[] {
  let blockStart = -1;
  for (let i = servicesSection.start + 1; i < servicesSection.end; i += 1) {
    if (getIndent(lines[i]) === 2 && lines[i].trim() === `${serviceName}:`) {
      blockStart = i;
      break;
    }
  }
  if (blockStart === -1) {
    return [];
  }

  let blockEnd = servicesSection.end;
  for (let i = blockStart + 1; i < servicesSection.end; i += 1) {
    const line = lines[i];
    if (line.trim().length === 0) {
      continue;
    }
    if (getIndent(line) <= 2) {
      blockEnd = i;
      break;
    }
  }

  return lines.slice(blockStart, blockEnd);
}

async function main(): Promise<void> {
  const composeFilePath = path.resolve(process.cwd(), "docker-compose.yml");
  assertTruthy(
    existsSync(composeFilePath),
    "docker-compose.yml does not exist at project root",
  );

  const lines = readFileSync(composeFilePath, "utf8").split("\n");

  const servicesSection = requireSection(
    findTopLevelSection(lines, "services"),
    "docker-compose.yml missing top-level services section",
  );
  const serviceNames = findEntryNames(lines, servicesSection, 2);
  assertTruthy(
    serviceNames.includes("postgres"),
    "docker-compose.yml missing postgres service",
  );
  assertTruthy(
    serviceNames.includes("opensearch"),
    "docker-compose.yml missing opensearch service",
  );

  const networksSection = requireSection(
    findTopLevelSection(lines, "networks"),
    "docker-compose.yml missing top-level networks section",
  );
  const networkNames = findEntryNames(lines, networksSection, 2);
  assertTruthy(
    networkNames.includes("public-ai-network"),
    "docker-compose.yml missing public-ai-network network",
  );

  const volumesSection = requireSection(
    findTopLevelSection(lines, "volumes"),
    "docker-compose.yml missing top-level volumes section",
  );
  const volumeNames = findEntryNames(lines, volumesSection, 2);
  assertTruthy(
    volumeNames.includes("postgres-data"),
    "docker-compose.yml missing postgres-data volume",
  );
  assertTruthy(
    volumeNames.includes("opensearch-data"),
    "docker-compose.yml missing opensearch-data volume",
  );

  const postgresBlock = extractServiceBlock(
    lines,
    servicesSection,
    "postgres",
  ).join("\n");
  assertTruthy(
    postgresBlock.includes("5432"),
    "postgres service does not expose port 5432",
  );
  assertTruthy(
    postgresBlock.includes("healthcheck:"),
    "postgres service missing healthcheck",
  );

  const opensearchBlock = extractServiceBlock(
    lines,
    servicesSection,
    "opensearch",
  ).join("\n");
  assertTruthy(
    opensearchBlock.includes("9200"),
    "opensearch service does not expose port 9200",
  );
  assertTruthy(
    opensearchBlock.includes("healthcheck:"),
    "opensearch service missing healthcheck",
  );

  console.log(
    "Local infrastructure validation succeeded (static docker-compose.yml parse, no Docker daemon required).",
  );
}

main();
