import type { LawGoKrConfig } from "./LawGoKrConfig";

const STATUTE_SEARCH_ENDPOINT = "/DRF/lawSearch.do";

export function buildLawGoKrStatuteSearchUrl(
  config: LawGoKrConfig,
  query: string,
): string {
  const url = new URL(STATUTE_SEARCH_ENDPOINT, config.baseUrl);
  url.search = new URLSearchParams({
    OC: config.oc,
    target: "law",
    type: "JSON",
    query,
  }).toString();

  return url.toString();
}
