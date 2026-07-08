import path from "node:path";

import { ImportStatutesUseCase } from "../application/ImportStatutesUseCase";
import { JsonLegalDocumentRepository } from "../persistence/JsonLegalDocumentRepository";
import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
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

  const openSearchConfig: OpenSearchConfig = {
    node: "fake://local-opensearch",
    indexName: "legal-documents",
  };
  const client = new FakeOpenSearchClient();
  const indexManager = new OpenSearchIndexManager(client, openSearchConfig);
  const indexer = new OpenSearchLegalDocumentIndexer(client, openSearchConfig);

  await indexManager.ensureLegalIndex();

  const useCase = new ImportStatutesUseCase(pipeline, indexer, repository);
  const importedResults = await useCase.execute(source);

  const searchEngine = new OpenSearchSearchEngine(client, openSearchConfig);
  const searchResults = await searchEngine.search({ text: QUERY });

  console.log(`Imported count: ${importedResults.length}`);
  console.log(`Persistence directory: ${PERSISTENCE_DIRECTORY}`);
  console.log(`Search result count: ${searchResults.length}`);
}

main();
