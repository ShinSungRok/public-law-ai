import type { AIResponseStream } from "../../ai/model/AIResponse";
import type {
  LLMCompletionRequest,
  LLMProvider,
} from "../../ai/provider/LLMProvider";
import type { AiPromptExecutor } from "./AiPromptExecutor";

export class AiPromptExecutorLlmProviderAdapter implements LLMProvider {
  constructor(
    private readonly aiPromptExecutor: AiPromptExecutor,
    private readonly model: string,
  ) {}

  streamCompletion(request: LLMCompletionRequest): AIResponseStream {
    const aiPromptExecutor = this.aiPromptExecutor;
    const model = this.model;

    return (async function* (): AIResponseStream {
      const response = await aiPromptExecutor.execute({
        systemPrompt: request.system,
        userPrompt: request.prompt,
        model,
      });
      yield { text: response.text };
    })();
  }
}
