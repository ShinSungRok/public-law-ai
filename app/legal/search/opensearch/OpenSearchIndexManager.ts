import type { OpenSearchClient } from "./OpenSearchClient";
import type { OpenSearchConfig } from "./OpenSearchConfig";
import { OPEN_SEARCH_LEGAL_INDEX_MAPPING } from "./OpenSearchLegalIndexMapping";

export class OpenSearchIndexManager {
  constructor(
    private readonly client: OpenSearchClient,
    private readonly config: OpenSearchConfig,
  ) {}

  async ensureLegalIndex(): Promise<void> {
    const exists = await this.client.indexExists(this.config.indexName);
    if (exists) {
      return;
    }

    await this.client.createIndex(
      this.config.indexName,
      OPEN_SEARCH_LEGAL_INDEX_MAPPING,
    );
  }
}
