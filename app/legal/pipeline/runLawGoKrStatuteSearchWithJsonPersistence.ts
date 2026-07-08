import path from "node:path";

import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import { JsonLegalDocumentRepository } from "../persistence/JsonLegalDocumentRepository";
import { FetchHttpClient } from "./http";
import { PublicLegalDataPipeline } from "./index";
import {
  LawGoKrStatuteSearchDownloader,
  LawGoKrStatuteSearchParser,
  assertLawGoKrConfig,
  createLawGoKrConfigFromEnv,
  createLawGoKrSource,
} from "./source";

const QUERY = "개인정보";
const PERSISTENCE_DIRECTORY = path.join("data", "legal-documents");

async function main(): Promise<void> {
  const config = createLawGoKrConfigFromEnv();
  assertLawGoKrConfig(config);
  const source = createLawGoKrSource();
  const httpClient = new FetchHttpClient();

  const pipeline = new PublicLegalDataPipeline(
    new LawGoKrStatuteSearchDownloader(httpClient, config, QUERY),
    new LawGoKrStatuteSearchParser(),
  );

  const repository = new JsonLegalDocumentRepository(PERSISTENCE_DIRECTORY);

  const useCase = new ImportStatutesUseCase(pipeline, undefined, repository);
  const importedResults = await useCase.execute(source);

  console.log(`Imported count: ${importedResults.length}`);
  console.log(`Persistence directory: ${PERSISTENCE_DIRECTORY}`);
}

main();
