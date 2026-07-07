import { FetchHttpClient } from "./http";
import { PublicLegalDataPipeline } from "./index";
import {
  LawGoKrStatuteSearchDownloader,
  LawGoKrStatuteSearchParser,
  createLawGoKrConfigFromEnv,
  createLawGoKrSource,
} from "./source";
import { assertLawGoKrConfig } from "./source/LawGoKrConfigFactory";

const QUERY = "개인정보";

async function main(): Promise<void> {
  const config = createLawGoKrConfigFromEnv();
  assertLawGoKrConfig(config);
  const source = createLawGoKrSource();
  const httpClient = new FetchHttpClient();

  const pipeline = new PublicLegalDataPipeline(
    new LawGoKrStatuteSearchDownloader(httpClient, config, QUERY),
    new LawGoKrStatuteSearchParser(),
  );

  const parsedResults = await pipeline.run(source);

  console.log(`Parsed document count: ${parsedResults.length}`);
  for (const parsed of parsedResults.slice(0, 5)) {
    console.log(`- ${parsed.document.id}: ${parsed.document.title}`);
  }
}

main();
