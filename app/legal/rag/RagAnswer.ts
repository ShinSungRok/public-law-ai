import type { Citation } from "../domain";

export interface RagAnswer {
  answer: string;
  citations: Citation[];
}
