import { buildCitation } from "../citation/CitationBuilder";
import type {
  RetrievalResult,
  RetrievedDocument,
} from "../retrieval/RetrievalResult";
import type { ContextDocument } from "./ContextDocument";
import type { PromptContext } from "./PromptContext";

function toContextDocument(
  retrievedDocument: RetrievedDocument,
): ContextDocument {
  return {
    id: retrievedDocument.document.id,
    title: retrievedDocument.document.title,
    text: retrievedDocument.document.text,
    citation: buildCitation(retrievedDocument.document),
  };
}

export function buildPromptContext(
  retrievalResult: RetrievalResult,
): PromptContext {
  const documents = retrievalResult.documents.map(toContextDocument);
  const citations = documents.map((document) => document.citation);

  return {
    query: retrievalResult.query,
    documents,
    citations,
  };
}
