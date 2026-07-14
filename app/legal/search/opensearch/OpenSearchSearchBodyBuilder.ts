import type { SearchQuery } from "../SearchQuery";

// TopK: left at 10 (unchanged). It already exceeds Recall@5 — the rank
// window RetrievalFailureAnalyzer/RetrievalMetricsEvaluationRunner treat as
// a success — so widening it further would only add noise to the prompt
// context (GenerateRagAnswerUseCase forwards every retrieved document,
// untruncated) without helping any measured metric.
const DEFAULT_SIZE = 10;

// Title carries the article number/subject (e.g. "제2조(정의)") and is the
// strongest exact-match signal available; boosting it 2x mirrors the
// title-over-text weighting convention already used by KeywordRetriever
// (title=2, text=1) and directly addresses the "wrong-document-ranked-higher"
// / "similar-article-competition" failure categories, where unrelated or
// sibling articles were winning on body-text overlap alone.
const TITLE_BOOST = 2;

// best_fields (OpenSearch's multi_match default) plus a tie_breaker lets a
// document that matches *both* title and text outrank one that only matches
// a single field at the same top score, instead of the two being treated as
// equally relevant.
const MULTI_MATCH_TYPE = "best_fields";
const TIE_BREAKER = 0.3;

// Reviewed, deliberately left unset: queries here are full natural-language
// questions ("개인정보의 정의는 무엇인가?"), where most tokens are
// interrogative/grammatical filler ("무엇인가") that never appears in statute
// text — a real question routinely carries only one or two content-bearing
// tokens that actually identify the target article. Measured against the
// evaluation dataset (runOpenSearchBm25OptimizationValidation.ts), any
// minimum_should_match strict enough to reject spurious single-token
// matches (e.g. 70%, even 30%) also rejects a large share of exactly those
// legitimate single-content-token questions, regressing hit rate/recall
// well below the no-threshold baseline. Ranking quality is instead improved
// via field boost + best_fields tie-breaking below, which reorders matches
// rather than discarding them.
export function buildOpenSearchKeywordSearchBody(query: SearchQuery): unknown {
  return {
    size: query.limit ?? DEFAULT_SIZE,
    query: {
      multi_match: {
        query: query.text,
        fields: [`title^${TITLE_BOOST}`, "text"],
        type: MULTI_MATCH_TYPE,
        tie_breaker: TIE_BREAKER,
      },
    },
  };
}
