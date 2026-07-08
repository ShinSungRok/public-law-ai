import path from "node:path";

import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import { JsonLegalDocumentRepository } from "../persistence/JsonLegalDocumentRepository";
import {
  FakePublicLegalDataDownloader,
  FakePublicLegalDataParser,
  PublicLegalDataPipeline,
} from "./index";
import type { PublicDataSource } from "./PublicDataSource";

const PERSISTENCE_DIRECTORY = path.join("data", "fake-legal-documents");

async function main(): Promise<void> {
  const source: PublicDataSource = {
    sourceSystem: "fake-source",
    sourceName: "Fake Public Legal Data Source",
    baseUrl: "https://fake.local",
  };

  const pipeline = new PublicLegalDataPipeline(
    new FakePublicLegalDataDownloader(),
    new FakePublicLegalDataParser(),
  );

  const repository = new JsonLegalDocumentRepository(PERSISTENCE_DIRECTORY);

  const useCase = new ImportStatutesUseCase(pipeline, undefined, repository);
  const importedResults = await useCase.execute(source);

  console.log(`Imported count: ${importedResults.length}`);
  console.log(`Persistence directory: ${PERSISTENCE_DIRECTORY}`);
}

main();
