import type { LLMCompletionRequest } from "../../ai/provider/LLMProvider";
import type { ContextDocument } from "../context/ContextDocument";
import type { PromptContext } from "../context/PromptContext";

const LEGAL_RAG_SYSTEM_PROMPT =
  "You are a legal information assistant. When retrieved legal context is " +
  "provided below, answer only using that context — never invent statutes, " +
  "cases, section numbers, or citations that are not explicitly provided. " +
  "If the provided context is insufficient to answer the question, say so " +
  "clearly instead of guessing. This is general legal information, not " +
  "legal advice; tell the user to verify with a licensed attorney or " +
  "primary source when precise legal authority matters.";

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

function buildUngroundedUserPrompt(context: PromptContext): string {
  return [
    "No retrieved legal sources were found for this question.",
    "Answer using general knowledge only, and clearly state that this " +
      "answer is not grounded in any retrieved legal source.",
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
