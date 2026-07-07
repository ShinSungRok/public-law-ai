import type { LLMProvider } from "../provider/LLMProvider";
import type { AIResponseStream } from "../model/AIResponse";
import type { Retriever } from "../../legal";
import { buildPromptContext, buildLegalPromptRequest } from "../../legal";

export class AIService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly retriever: Retriever,
  ) {}

  answerLegalQuestion(question: string): AIResponseStream {
    const { provider, retriever } = this;

    return (async function* (): AIResponseStream {
      const retrievalResult = await retriever.retrieve(question);
      const promptContext = buildPromptContext(retrievalResult);
      const promptRequest = buildLegalPromptRequest(promptContext);

      yield* provider.streamCompletion(promptRequest);
    })();
  }
}
