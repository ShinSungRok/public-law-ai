import { buildLegalPromptRequest } from "./LegalPromptBuilder";
import type { Citation } from "../domain/Citation";
import type { ContextDocument } from "../context/ContextDocument";
import type { PromptContext } from "../context/PromptContext";

// Same literal marker LegalPromptBuilder.ts uses to switch between a
// grounded and an ungrounded prompt — several RAG/evaluation validations
// (runRagGroundingValidation.ts, runGroundingMetricsValidation.ts,
// runUnifiedEvaluationReportValidation.ts,
// runUnifiedReportRegressionValidation.ts) key off this exact string, so it
// must not change without updating all of them.
const GROUNDED_MARKER = "Retrieved legal context:";
const UNGROUNDED_MARKER = "No retrieved legal sources were found for this question.";

const QUESTION = "개인정보 보호법 제29조의 안전조치의무는 무엇인가?";

const CITATION: Citation = {
  id: "citation-1",
  sourceType: "statute_article",
  sourceId: "011461:29",
  displayText: "개인정보 보호법 제29조(안전조치의무)",
  sourceUrl: "https://www.law.go.kr/DRF/lawService.do?target=law&ID=011461&JO=002900",
  snippet: "개인정보처리자는 안전성 확보에 필요한 조치를 하여야 한다.",
};

const DOCUMENT: ContextDocument = {
  id: "011461:29",
  title: "개인정보 보호법 제29조(안전조치의무)",
  text: "개인정보처리자는 개인정보가 분실·도난·유출·위조·변조 또는 훼손되지 아니하도록 안전성 확보에 필요한 조치를 하여야 한다.",
  citation: CITATION,
};

const GROUNDED_CONTEXT: PromptContext = {
  query: QUESTION,
  documents: [DOCUMENT],
  citations: [CITATION],
};

const UNGROUNDED_CONTEXT: PromptContext = {
  query: QUESTION,
  documents: [],
  citations: [],
};

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function validateGroundedPromptConstruction(): void {
  const request = buildLegalPromptRequest(GROUNDED_CONTEXT);

  assertTruthy(
    request.prompt.startsWith(GROUNDED_MARKER),
    "expected the grounded prompt to open with the existing grounded-marker contract",
  );
  assertTruthy(
    request.prompt.includes(DOCUMENT.title),
    "expected the grounded prompt to include the retrieved document title",
  );
  assertTruthy(
    request.prompt.includes(DOCUMENT.text),
    "expected the grounded prompt to include the retrieved document body text",
  );
  assertTruthy(
    request.prompt.includes(QUESTION),
    "expected the grounded prompt to include the original question",
  );
  assertTruthy(
    request.system.includes("Public Law AI"),
    "expected the system prompt to identify the assistant as Public Law AI",
  );
  assertTruthy(
    request.system.includes("legal information, not legal advice"),
    "expected the system prompt to state it provides legal information, not legal advice",
  );

  // Determinism: identical input must produce byte-identical output.
  const repeat = buildLegalPromptRequest(GROUNDED_CONTEXT);
  assertEqual(repeat.prompt, request.prompt, "expected grounded prompt construction to be deterministic");
  assertEqual(repeat.system, request.system, "expected the system prompt to be deterministic");
}

function validateCitationInstructions(): void {
  const request = buildLegalPromptRequest(GROUNDED_CONTEXT);

  assertTruthy(
    request.system.includes("Available citations"),
    "expected the system prompt to reference the Available citations list",
  );
  assertTruthy(
    request.system.toLowerCase().includes("never invent, rewrite, merge, or renumber"),
    "expected the system prompt to forbid inventing/rewriting/merging/renumbering citations",
  );
  assertTruthy(
    request.system.includes("near the claim it supports"),
    "expected the system prompt to instruct placing citations near the claims they support",
  );
  assertTruthy(
    request.prompt.includes("Available citations (cite only these, exactly as written):"),
    "expected the user prompt to still carry the exact-citation-list instruction",
  );
  assertTruthy(
    request.prompt.includes(`1. ${CITATION.displayText} - ${CITATION.sourceUrl}`),
    "expected the user prompt's citation list formatting to remain deterministic",
  );
}

function validateKoreanAnswerInstruction(): void {
  const request = buildLegalPromptRequest(GROUNDED_CONTEXT);

  assertTruthy(
    request.system.includes("Answer in Korean unless the user explicitly requests another language."),
    "expected the system prompt to instruct answering in Korean by default",
  );
}

function validateInsufficientContextBehavior(): void {
  const request = buildLegalPromptRequest(UNGROUNDED_CONTEXT);

  assertTruthy(
    request.prompt.startsWith(UNGROUNDED_MARKER),
    "expected the ungrounded prompt to open with the existing ungrounded-marker contract",
  );
  assertTruthy(
    !request.prompt.includes(GROUNDED_MARKER),
    "expected an insufficient-context prompt not to claim grounding",
  );
  assertTruthy(
    request.prompt.includes("Personal Information Protection Act"),
    "expected the ungrounded prompt to explain the current indexed legal coverage",
  );
  assertTruthy(
    request.prompt.toLowerCase().includes("consult a qualified legal professional"),
    "expected the ungrounded prompt to recommend consulting a qualified professional",
  );
  assertTruthy(
    request.prompt.includes("check the official statute text"),
    "expected the ungrounded prompt to recommend checking the official statute text",
  );
  assertTruthy(
    request.prompt.includes(QUESTION),
    "expected the ungrounded prompt to still include the original question",
  );
}

function validateNoGeneralKnowledgeInstruction(): void {
  const groundedRequest = buildLegalPromptRequest(GROUNDED_CONTEXT);
  const ungroundedRequest = buildLegalPromptRequest(UNGROUNDED_CONTEXT);

  const allText = [
    groundedRequest.system,
    groundedRequest.prompt,
    ungroundedRequest.system,
    ungroundedRequest.prompt,
  ].join("\n");

  assertTruthy(
    !allText.toLowerCase().includes("general knowledge"),
    "expected the old 'answer using general knowledge only' instruction to be fully removed",
  );
}

function main(): void {
  console.log("[prompt] 1. Grounded prompt construction...");
  validateGroundedPromptConstruction();

  console.log("[prompt] 2. Citation instructions...");
  validateCitationInstructions();

  console.log("[prompt] 3. Korean answer instruction...");
  validateKoreanAnswerInstruction();

  console.log("[prompt] 4. Insufficient-context behavior...");
  validateInsufficientContextBehavior();

  console.log("[prompt] 5. Absence of the old general-knowledge instruction...");
  validateNoGeneralKnowledgeInstruction();

  console.log("Legal prompt builder validation succeeded.");
}

main();
