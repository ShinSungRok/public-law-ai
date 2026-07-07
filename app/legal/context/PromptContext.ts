import type { Citation } from "../domain/Citation";
import type { ContextDocument } from "./ContextDocument";

export interface PromptContext {
  query: string;
  documents: ContextDocument[];
  citations: Citation[];
}
