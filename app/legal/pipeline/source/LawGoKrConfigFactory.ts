import type { LawGoKrConfig } from "./LawGoKrConfig";

const DEFAULT_BASE_URL = "https://www.law.go.kr";
const DEFAULT_OC = "";

export function createLawGoKrConfigFromEnv(): LawGoKrConfig {
  return {
    baseUrl: process.env.LAW_GO_KR_BASE_URL || DEFAULT_BASE_URL,
    oc: process.env.LAW_GO_KR_OC || DEFAULT_OC,
  };
}
