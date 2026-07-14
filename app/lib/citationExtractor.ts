// Best-effort, client-side extraction of Korean statute/article references
// (e.g. "개인정보 보호법 제29조(안전조치의무)", "제15조의2") from the plain
// streamed answer text. This never touches /api/ask or any backend citation
// data — the route only streams answer text today — it purely reads the
// text already rendered on screen to surface a "referenced statutes"
// section. Best-effort by design: false negatives just omit a chip, they
// never fabricate one, since the pattern only matches text that actually
// appears in the answer.
const CITATION_PATTERN =
  /(?:(?:[가-힣A-Za-z0-9·ㆍ]+[^\S\n]){0,2}[가-힣A-Za-z0-9·ㆍ]*(?:법률|법|규칙|조례|시행령|시행규칙)[^\S\n]*)?제\d+(?:-\d+)?조(?:의\d+)?(?:\([^)\n]{1,24}\))?/g;

export function extractCitations(text: string): string[] {
  const matches = text.match(CITATION_PATTERN) ?? [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const raw of matches) {
    const cleaned = raw.replace(/[*_`]/g, "").trim();
    if (cleaned.length > 0 && !seen.has(cleaned)) {
      seen.add(cleaned);
      results.push(cleaned);
    }
  }

  return results;
}
