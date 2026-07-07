import { FakeOpenSearchClient } from "../search/opensearch/FakeOpenSearchClient";
import type { OpenSearchConfig } from "../search/opensearch/OpenSearchConfig";
import { OpenSearchIndexManager } from "../search/opensearch/OpenSearchIndexManager";
import { OpenSearchLegalDocumentIndexer } from "../search/opensearch/OpenSearchLegalDocumentIndexer";
import { OpenSearchSearchEngine } from "../search/opensearch/OpenSearchSearchEngine";
import {
  FakePublicLegalDataDownloader,
  FakePublicLegalDataParser,
  PublicLegalDataPipeline,
} from "./index";
import type { PublicDataSource } from "./PublicDataSource";

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
  const parsedResults = await pipeline.run(source);

  const config: OpenSearchConfig = {
    node: "fake://local-opensearch",
    indexName: "legal-documents",
  };
  const client = new FakeOpenSearchClient();
  const indexManager = new OpenSearchIndexManager(client, config);
  const indexer = new OpenSearchLegalDocumentIndexer(client, config);

  await indexManager.ensureLegalIndex();
  for (const parsed of parsedResults) {
    await indexer.index(parsed.document);
  }

  const searchEngine = new OpenSearchSearchEngine(client, config);
  const searchResults = await searchEngine.search({ text: "Fake" });

  console.log(`Indexed count: ${parsedResults.length}`);
  console.log(`Search result count: ${searchResults.length}`);
}

main();
