import { IndexDocumentEmbeddingsUseCase } from "../application/IndexDocumentEmbeddingsUseCase";
import type { LegalDocument } from "../domain";
import {
  BatchChunkEmbeddingPipeline,
  BatchEmbeddingService,
  ChunkEmbeddingPipeline,
  EmbeddingService,
  FakeEmbeddingModel,
  FakeVectorIndexer,
  SingleChunkChunkingService,
} from "../embedding";

async function main(): Promise<void> {
  const document: LegalDocument = {
    id: "fake-document-1",
    documentType: "STATUTE_ARTICLE",
    title: "Fake Statute Article",
    text: "This is fake statute article text for embedding pipeline validation.",
    metadata: {
      sourceSystem: "fake-source",
      sourceId: "fake-article-1",
      sourceUrl: "https://fake.local",
      retrievedAt: new Date().toISOString(),
    },
    sourceRef: {
      sourceType: "statute_article",
      sourceId: "fake-article-1",
    },
  };

  const embeddingModel = new FakeEmbeddingModel();
  const embeddingService = new EmbeddingService(embeddingModel);
  const batchEmbeddingService = new BatchEmbeddingService(embeddingService);
  const chunkingService = new SingleChunkChunkingService();
  const chunkEmbeddingPipeline = new ChunkEmbeddingPipeline(
    chunkingService,
    batchEmbeddingService,
  );
  const batchChunkEmbeddingPipeline = new BatchChunkEmbeddingPipeline(
    chunkEmbeddingPipeline,
  );
  const vectorIndexer = new FakeVectorIndexer();

  const useCase = new IndexDocumentEmbeddingsUseCase(
    batchChunkEmbeddingPipeline,
    vectorIndexer,
  );

  await useCase.execute([document]);

  const indexedVectors = vectorIndexer.getIndexedVectors();

  console.log(`Indexed vector count: ${indexedVectors.length}`);
  console.log(
    `Indexed vector ids: ${indexedVectors.map((vector) => vector.id).join(", ")}`,
  );
}

main();
