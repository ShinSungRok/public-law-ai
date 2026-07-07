import type { LawGoKrConfig } from "./LawGoKrConfig";

const DEFAULT_BASE_URL = "https://www.law.go.kr";
const DEFAULT_OC = "";

export function createLawGoKrConfigFromEnv(): LawGoKrConfig {
  return {
    baseUrl: process.env.LAW_GO_KR_BASE_URL || DEFAULT_BASE_URL,
    oc: process.env.LAW_GO_KR_OC || DEFAULT_OC,
  };
}

export function assertLawGoKrConfig(config: LawGoKrConfig): void {
  if (!config.oc) {
    throw new Error("LAW_GO_KR_OC is required to run law.go.kr pipeline");
  }
}
