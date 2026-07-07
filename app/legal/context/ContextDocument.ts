import type { Citation } from "../domain/Citation";

export interface ContextDocument {
  id: string;
  title: string;
  text: string;
  citation: Citation;
}
