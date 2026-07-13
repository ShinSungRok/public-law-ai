import type { LawGoKrConfig } from "./LawGoKrConfig";

const STATUTE_SEARCH_ENDPOINT = "/DRF/lawSearch.do";
const STATUTE_DETAIL_ENDPOINT = "/DRF/lawService.do";

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

/**
 * `ID` accepts either the 법령ID or 법령일련번호(MST) returned by the search
 * endpoint (law.go.kr Open API guide: "Either ID or MST must be provided").
 * The search parser only preserves one identifier per result, so this always
 * sends it as `ID`.
 */
export function buildLawGoKrStatuteDetailUrl(
  config: LawGoKrConfig,
  statuteId: string,
): string {
  const url = new URL(STATUTE_DETAIL_ENDPOINT, config.baseUrl);
  url.search = new URLSearchParams({
    OC: config.oc,
    target: "law",
    type: "JSON",
    ID: statuteId,
  }).toString();

  return url.toString();
}

/**
 * Deterministic article-level viewer link, built the same way as
 * `buildLawGoKrStatuteDetailUrl` (same endpoint/ID/JO params) but with `OC`
 * omitted so the caller's registered key is never embedded in indexed
 * `LegalDocument.metadata.sourceUrl`.
 */
export function buildLawGoKrStatuteDetailViewUrl(
  baseUrl: string,
  statuteId: string,
  articleJo?: string,
): string {
  const url = new URL(STATUTE_DETAIL_ENDPOINT, baseUrl);
  const params: Record<string, string> = {
    target: "law",
    type: "HTML",
    ID: statuteId,
  };
  if (articleJo) {
    params.JO = articleJo;
  }
  url.search = new URLSearchParams(params).toString();

  return url.toString();
}
