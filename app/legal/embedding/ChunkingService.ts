import type { DocumentChunk, LegalDocument } from "../domain";

export interface ChunkingService {
  chunk(document: LegalDocument): DocumentChunk[];
}
