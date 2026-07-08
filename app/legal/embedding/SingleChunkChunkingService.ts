import type { DocumentChunk, LegalDocument } from "../domain";
import type { ChunkingService } from "./ChunkingService";

export class SingleChunkChunkingService implements ChunkingService {
  chunk(document: LegalDocument): DocumentChunk[] {
    return [
      {
        id: document.id,
        documentId: document.id,
        text: document.text,
        order: 0,
      },
    ];
  }
}
