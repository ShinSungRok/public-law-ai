import type { EvaluationCase } from "./EvaluationCase";

/**
 * The eight coverage buckets this dataset is required to span. Kept local
 * to this file (rather than widening the shared, target-agnostic
 * `EvaluationCase.metadata: Record<string, unknown>`) since it is a
 * dataset-authoring concern, not part of the reusable evaluation framework.
 */
export const RAG_EVALUATION_CATEGORIES = [
  "definition",
  "principles",
  "collection-use",
  "provision-transfer",
  "data-subject-rights",
  "security",
  "query-variation",
  "negative",
] as const;

export type RagEvaluationCategory = (typeof RAG_EVALUATION_CATEGORIES)[number];

export interface RagEvaluationCaseMetadata {
  [key: string]: unknown;
  category: RagEvaluationCategory;
  /** Cases sharing a group id are differently-worded questions expected to resolve to the same document(s). */
  variationGroup?: string;
}

function buildCase(
  id: string,
  name: string,
  query: string,
  expectedDocumentIds: string[],
  category: RagEvaluationCategory,
  options: {
    expectedAnswerKeywords?: string[];
    variationGroup?: string;
  } = {},
): EvaluationCase {
  const metadata: RagEvaluationCaseMetadata = {
    category,
    ...(options.variationGroup ? { variationGroup: options.variationGroup } : {}),
  };

  return {
    id,
    name,
    target: "retrieval",
    query,
    expectedDocumentIds,
    expectedCitationDocumentIds:
      expectedDocumentIds.length > 0 ? expectedDocumentIds : undefined,
    expectedAnswerKeywords: options.expectedAnswerKeywords,
    metadata,
  };
}

// All expectedDocumentIds below reference article ids actually present in
// the production OpenSearch index (public-law-ai-local) as of Phase 24 —
// verified live via GET /public-law-ai-local/_doc/<id> before being added
// here, not guessed. Primarily 개인정보 보호법 (statute id 011357) and its
// 시행령/enforcement decree (011468), per "Use the currently indexed legal
// domain".

const DEFINITION_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-definition-001",
    "definition of 개인정보",
    "개인정보의 정의는 무엇인가?",
    ["011357:2"],
    "definition",
    { expectedAnswerKeywords: ["개인정보", "살아 있는 개인"] },
  ),
  buildCase(
    "rag-eval-definition-002",
    "definition of 정보주체",
    "개인정보 보호법에서 정보주체란 누구를 의미하는가?",
    ["011357:2"],
    "definition",
    { expectedAnswerKeywords: ["정보주체"] },
  ),
  buildCase(
    "rag-eval-definition-003",
    "definition of 가명처리",
    "가명처리란 무엇을 의미하는가?",
    ["011357:2"],
    "definition",
    { expectedAnswerKeywords: ["가명처리"] },
  ),
];

const PRINCIPLES_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-principles-001",
    "개인정보 보호 원칙 개요",
    "개인정보 보호 원칙은 무엇인가?",
    ["011357:3"],
    "principles",
    { expectedAnswerKeywords: ["최소한의 개인정보"] },
  ),
  buildCase(
    "rag-eval-principles-002",
    "개인정보처리자가 준수할 원칙",
    "개인정보처리자가 준수해야 할 개인정보 보호 원칙에는 어떤 것이 있는가?",
    ["011357:3"],
    "principles",
  ),
  buildCase(
    "rag-eval-principles-003",
    "최소 수집 원칙",
    "개인정보처리자는 어떤 범위에서 개인정보를 수집해야 하는가?",
    ["011357:3"],
    "principles",
    { expectedAnswerKeywords: ["목적에 필요한 범위"] },
  ),
];

const COLLECTION_USE_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-collection-use-001",
    "개인정보의 수집 제한",
    "개인정보의 수집 제한에 관한 규정은 무엇인가?",
    ["011357:16"],
    "collection-use",
  ),
  buildCase(
    "rag-eval-collection-use-002",
    "목적 외 이용ㆍ제공 제한",
    "개인정보의 목적 외 이용이나 제공은 어떤 경우에 제한되는가?",
    ["011357:18"],
    "collection-use",
  ),
  buildCase(
    "rag-eval-collection-use-003",
    "동의를 받는 방법",
    "정보주체의 동의를 받는 방법은 어떻게 되는가?",
    ["011357:22"],
    "collection-use",
  ),
  buildCase(
    "rag-eval-collection-use-004",
    "개인정보의 파기",
    "개인정보는 언제, 어떻게 파기해야 하는가?",
    ["011357:21"],
    "collection-use",
    { expectedAnswerKeywords: ["파기"] },
  ),
];

const PROVISION_TRANSFER_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-provision-transfer-001",
    "제3자 제공 요건",
    "개인정보를 제3자에게 제공할 때의 요건은 무엇인가?",
    ["011357:17"],
    "provision-transfer",
  ),
  buildCase(
    "rag-eval-provision-transfer-002",
    "영업양도에 따른 이전 제한",
    "영업양도에 따라 개인정보가 이전될 때 제한되는 사항은 무엇인가?",
    ["011357:27"],
    "provision-transfer",
  ),
  buildCase(
    "rag-eval-provision-transfer-003",
    "국외 이전 중지 명령",
    "개인정보의 국외 이전을 중지하도록 명령할 수 있는 경우는 언제인가?",
    ["011357:28-9"],
    "provision-transfer",
    { expectedAnswerKeywords: ["국외 이전"] },
  ),
];

const DATA_SUBJECT_RIGHTS_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-data-subject-rights-001",
    "정보주체의 권리 목록",
    "정보주체가 개인정보 보호법상 행사할 수 있는 권리에는 어떤 것이 있는가?",
    ["011357:4"],
    "data-subject-rights",
    { expectedAnswerKeywords: ["정보주체"] },
  ),
  buildCase(
    "rag-eval-data-subject-rights-002",
    "정정ㆍ삭제 요구권",
    "개인정보의 정정이나 삭제를 요구하려면 어떻게 해야 하는가?",
    ["011357:36"],
    "data-subject-rights",
    { expectedAnswerKeywords: ["정정"] },
  ),
  buildCase(
    "rag-eval-data-subject-rights-003",
    "처리정지 요구권",
    "정보주체는 어떤 경우에 개인정보 처리정지를 요구할 수 있는가?",
    ["011357:37"],
    "data-subject-rights",
    { expectedAnswerKeywords: ["처리정지"] },
  ),
  buildCase(
    "rag-eval-data-subject-rights-004",
    "손해배상책임",
    "개인정보 침해로 손해를 입은 경우 손해배상책임은 어떻게 되는가?",
    ["011357:39"],
    "data-subject-rights",
    { expectedAnswerKeywords: ["손해배상"] },
  ),
];

const SECURITY_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-security-001",
    "가명정보 안전조치의무",
    "가명정보를 처리할 때 취해야 할 안전조치의무는 무엇인가?",
    ["011357:28-4"],
    "security",
    { expectedAnswerKeywords: ["가명정보"] },
  ),
  buildCase(
    "rag-eval-security-002",
    "고유식별정보 안전성 확보조치",
    "고유식별정보의 안전성을 확보하기 위한 조치는 무엇인가?",
    ["011468:21"],
    "security",
  ),
  buildCase(
    "rag-eval-security-003",
    "개인정보 유출 통지ㆍ신고",
    "개인정보가 유출되었을 때 통지하고 신고해야 할 의무는 무엇인가?",
    ["011357:34"],
    "security",
    { expectedAnswerKeywords: ["유출"] },
  ),
];

// Two clusters of differently-worded questions that must resolve to the
// same document(s) — validated for consistency below.
const QUERY_VARIATION_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-query-variation-definition-001",
    "정의 질의 변형 A",
    "개인정보란 무엇을 의미하는가요?",
    ["011357:2"],
    "query-variation",
    { variationGroup: "definition-011357-2" },
  ),
  buildCase(
    "rag-eval-query-variation-definition-002",
    "정의 질의 변형 B",
    "개인정보 개념을 설명해줘",
    ["011357:2"],
    "query-variation",
    { variationGroup: "definition-011357-2" },
  ),
  buildCase(
    "rag-eval-query-variation-definition-003",
    "정의 질의 변형 C",
    "법적으로 개인정보는 어떻게 정의되나요?",
    ["011357:2"],
    "query-variation",
    { variationGroup: "definition-011357-2" },
  ),
  buildCase(
    "rag-eval-query-variation-collection-001",
    "수집 제한 질의 변형 A",
    "개인정보를 수집할 때 제한되는 사항은 무엇인가요?",
    ["011357:16"],
    "query-variation",
    { variationGroup: "collection-011357-16" },
  ),
  buildCase(
    "rag-eval-query-variation-collection-002",
    "수집 제한 질의 변형 B",
    "개인정보 수집 시 지켜야 할 제한은?",
    ["011357:16"],
    "query-variation",
    { variationGroup: "collection-011357-16" },
  ),
  buildCase(
    "rag-eval-query-variation-collection-003",
    "수집 제한 질의 변형 C",
    "개인정보 수집을 제한하는 법적 근거를 알려줘",
    ["011357:16"],
    "query-variation",
    { variationGroup: "collection-011357-16" },
  ),
];

// Out-of-domain questions: nothing in the currently indexed dataset should
// be returned as relevant. expectedDocumentIds is intentionally empty.
const NEGATIVE_CASES: EvaluationCase[] = [
  buildCase(
    "rag-eval-negative-001",
    "형법 살인죄 (out of domain)",
    "형법상 살인죄의 처벌 규정은 무엇인가?",
    [],
    "negative",
  ),
  buildCase(
    "rag-eval-negative-002",
    "상속 유류분 (out of domain)",
    "상속인의 유류분은 어떻게 계산하는가?",
    [],
    "negative",
  ),
  buildCase(
    "rag-eval-negative-003",
    "소득세 세율 (out of domain)",
    "소득세의 과세표준과 세율은 어떻게 정해지는가?",
    [],
    "negative",
  ),
];

export const RAG_EVALUATION_DATASET: EvaluationCase[] = [
  ...DEFINITION_CASES,
  ...PRINCIPLES_CASES,
  ...COLLECTION_USE_CASES,
  ...PROVISION_TRANSFER_CASES,
  ...DATA_SUBJECT_RIGHTS_CASES,
  ...SECURITY_CASES,
  ...QUERY_VARIATION_CASES,
  ...NEGATIVE_CASES,
];
