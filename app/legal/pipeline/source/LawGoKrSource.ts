import type { PublicDataSource } from "../PublicDataSource";

export function createLawGoKrSource(): PublicDataSource {
  return {
    sourceSystem: "law.go.kr",
    sourceName: "National Law Information Center",
    baseUrl: "https://www.law.go.kr",
  };
}
