import type { RetrievalResult } from "./RetrievalResult";

export interface Retriever {
  retrieve(query: string): Promise<RetrievalResult>;
}
