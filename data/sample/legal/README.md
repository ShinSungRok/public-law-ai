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

## Current status: one real statute article, one real court case

The law.go.kr **Open API** (`lawSearch.do` / `lawService.do`) still rejects
unregistered callers in this environment ("사용자 정보 검증에 실패하였습니다"
— IP/domain must be registered first), and the main law.go.kr statute viewer
is a JS-rendered SPA that a plain fetch can't scrape. However, law.go.kr's
`lsLinkProc.do` (article deep-link) and `LSW/precInfoP.do` (case detail)
endpoints do return server-rendered content, and were used to populate:

- `statutes/statute.sample.json` + `statutes/statute-article.sample.json`:
  **민법 (Civil Act) 제750조 (불법행위의 내용)**. The article text
  ("고의 또는 과실로 인한 위법행위로 타인에게 손해를 가한 자는 그 손해를
  배상할 책임이 있다.") was cross-checked against three independent sources
  (law.go.kr, casenote.kr, and the Korean Wikipedia article on 민법 제750조)
  and matched exactly before being recorded.
- `cases/court-case.sample.json`: **대법원 1970. 7. 24. 선고 70다798 판결**
  (a tort/caregiver-cost case citing Civil Act Article 750). The `holdingGist`
  (판시사항) is a verbatim quote independently fetched from `casenote.kr` and
  cross-checked in substance against the law.go.kr record for the same
  `precSeq`.

**TODO — fields deliberately left empty because they were not independently
verified via a direct fetch in this session** (only seen in a search-engine
summary, which is not treated as a verified source here):
- `statute.sample.json`: `ministry` (소관부처), `promulgationDate` (공포일자,
  original enactment date), `lawMasterNo` (law.go.kr's internal MST id),
  `titleEn`.
- `court-case.sample.json`: `judgmentSummary` (판결요지) — only an English
  paraphrase was obtained via direct fetch, not verbatim Korean, so it was
  left blank rather than risk a non-verbatim quote in a citation-backing
  field. `fullText` was never retrieved.

Filling these in requires either a registered law.go.kr OC key (for the
Open API), or another direct fetch that independently confirms the exact
verbatim value — not a search-summary approximation.

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
