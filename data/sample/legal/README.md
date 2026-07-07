# Sample Legal Data (Local Development Only)

This folder holds local sample data for developing against the legal domain
models in `app/legal/domain/`. It is a stand-in for the real ingestion
pipeline described in Phase 2-A (Public API → Raw Data → Normalized JSON →
PostgreSQL → OpenSearch), not a permanent data source.

## Provenance rule

All data here must ultimately come from public legal sources — primarily
**국가법령정보센터 / law.go.kr (National Law Information Center)**. Fabricated
or made-up statute text, article text, or court case text is **not allowed**,
even as a placeholder for "realistic-looking" content. If real, verified
source text is not available in the current environment, the correct action
is to leave the content fields empty (not to invent plausible-sounding text).

## Current status: schema-only placeholders

**TODO:** The JSON files in `statutes/` and `cases/` are currently
schema-only placeholders. Every field is present so the shape matches the
domain models exactly, but content fields (titles, dates, article text,
holding/summary text, ids) are empty strings or empty arrays because this
environment does not have:

- a registered OC (API key) for the law.go.kr Open API (`lawSearch.do` /
  `lawService.do` reject unregistered callers with "사용자 정보 검증에
  실패하였습니다" — IP/domain must be registered first), and
- a way to reliably scrape verified article/case text from the public web
  viewer (it did not return usable statute content via fetch in this
  environment).

**TODO before these files are used for real development:**
1. Register an OC key at law.go.kr for this project.
2. Fetch one real statute (e.g. via `lawService.do?target=law&MST=...`) and
   fill in `statute.sample.json` with its real `lawId`, `titleKo`, dates,
   ministry, and `status`.
3. Pick one real article from that statute's response and fill in
   `statute-article.sample.json` with its real `articleNo`, `articleTitle`,
   and `paragraphs` text, copied verbatim from the source.
4. Fetch one real court case (target=prec) and fill in
   `court-case.sample.json` with its real case number, court, dates, and the
   verbatim `holdingGist`/`judgmentSummary` text.
5. Fill in each `metadata.sourceUrl` / `sourceId` / `retrievedAt` with the
   real values from that fetch, so every sample file is traceable back to
   its public source.

## Directory structure

```
data/sample/legal/
  statutes/
    statute.sample.json          # StatuteDocument shape
    statute-article.sample.json  # StatuteArticle shape
  cases/
    court-case.sample.json       # CourtCaseDocument shape
```

## Replacing this folder later

Once the real ingestion pipeline exists, these manually-maintained files are
replaced by pipeline output — this folder is a development convenience, not
a target for repositories to depend on long-term.
