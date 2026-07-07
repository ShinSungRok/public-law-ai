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

  console.log(`Parsed document count: ${parsedResults.length}`);
  for (const parsed of parsedResults) {
    console.log(`- ${parsed.document.id}`);
  }
}

main();
