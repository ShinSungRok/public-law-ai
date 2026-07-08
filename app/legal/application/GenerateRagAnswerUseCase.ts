import type { LLMProvider } from "../../ai/provider/LLMProvider";
import { buildPromptContext } from "../context/PromptContextBuilder";
import { buildLegalPromptRequest } from "../prompt/LegalPromptBuilder";
import type { RagAnswer } from "../rag/RagAnswer";
import type { RagAnswerBuilder } from "../rag/RagAnswerBuilder";
import type { RetrievedDocument } from "../retrieval/RetrievalResult";
import type { Retriever } from "../retrieval/Retriever";
import type { SearchResult } from "../search/model/SearchResult";

function toSearchResult(retrievedDocument: RetrievedDocument): SearchResult {
  return {
    document: retrievedDocument.document,
    score: retrievedDocument.score,
    source: "keyword",
  };
}

export class GenerateRagAnswerUseCase {
  constructor(
    private readonly retriever: Retriever,
    private readonly llmProvider: LLMProvider,
    private readonly ragAnswerBuilder: RagAnswerBuilder,
  ) {}

  async execute(query: string): Promise<RagAnswer> {
    const retrievalResult = await this.retriever.retrieve(query);
    const promptContext = buildPromptContext(retrievalResult);
    const promptRequest = buildLegalPromptRequest(promptContext);

    let answer = "";
    for await (const chunk of this.llmProvider.streamCompletion(
      promptRequest,
    )) {
      answer += chunk.text;
    }

    const searchResults = retrievalResult.documents.map(toSearchResult);
    return this.ragAnswerBuilder.build(answer, searchResults);
  }
}
