import type { LLMCompletionRequest } from "../../ai/provider/LLMProvider";
import type { ContextDocument } from "../context/ContextDocument";
import type { PromptContext } from "../context/PromptContext";

const LEGAL_RAG_SYSTEM_PROMPT = [
  "You are Public Law AI, a Korean legal information assistant. You " +
    "provide legal information, not legal advice.",
  "",
  "Grounding rules:",
  "- Answer only using the retrieved legal context provided below.",
  "- Never rely on your own memory for statutes, article numbers, " +
    "requirements, exceptions, or citations.",
  "- Do not infer facts that are not supported by the retrieved text.",
  "- If the retrieved context is insufficient to answer the question, say " +
    "so clearly instead of guessing.",
  "",
  "Citation rules:",
  '- Cite only entries listed under "Available citations".',
  "- Preserve citation text exactly as provided — never invent, rewrite, " +
    "merge, or renumber a citation.",
  "- Place each citation near the claim it supports.",
  "",
  "Answer structure:",
  "- Answer in Korean unless the user explicitly requests another " +
    "language.",
  "- Start with a concise, direct answer.",
  "- Then explain the legal basis for that answer.",
  "- Include exceptions or limitations only when the retrieved context " +
    "supports them.",
  "- Avoid unnecessary repetition and overly long disclaimers.",
  "",
  "If the retrieved documents conflict with each other, explain the " +
    "conflict instead of silently choosing one side without support.",
].join("\n");

function formatContextDocument(
  document: ContextDocument,
  index: number,
): string {
  return [
    `[${index + 1}] ${document.title}`,
    `Source: ${document.citation.displayText} (${document.citation.sourceUrl})`,
    `Text: ${document.text}`,
  ].join("\n");
}

function formatCitationList(context: PromptContext): string {
  return context.citations
    .map(
      (citation, index) =>
        `${index + 1}. ${citation.displayText} - ${citation.sourceUrl}`,
    )
    .join("\n");
}

function buildGroundedUserPrompt(context: PromptContext): string {
  const documentsSection = context.documents
    .map((document, index) => formatContextDocument(document, index))
    .join("\n\n");

  return [
    "Retrieved legal context:",
    documentsSection,
    "",
    "Available citations (cite only these, exactly as written):",
    formatCitationList(context),
    "",
    `Question: ${context.query}`,
  ].join("\n");
}

const CURRENT_COVERAGE_NOTICE =
  "Currently indexed legal coverage: the Personal Information Protection " +
  "Act (개인정보 보호법) and related regulations, sourced from law.go.kr. " +
  "Questions outside this coverage will not have a grounded answer yet.";

function buildUngroundedUserPrompt(context: PromptContext): string {
  return [
    "No retrieved legal sources were found for this question.",
    "Do not answer this question from memory or assumption. State " +
      "clearly that no sufficient retrieved legal source was found.",
    CURRENT_COVERAGE_NOTICE,
    "Recommend that the user check the official statute text directly, " +
      "or consult a qualified legal professional if the answer matters.",
    "",
    `Question: ${context.query}`,
  ].join("\n");
}

export function buildLegalPromptRequest(
  context: PromptContext,
): LLMCompletionRequest {
  const prompt =
    context.documents.length > 0
      ? buildGroundedUserPrompt(context)
      : buildUngroundedUserPrompt(context);

  return {
    system: LEGAL_RAG_SYSTEM_PROMPT,
    prompt,
  };
}
