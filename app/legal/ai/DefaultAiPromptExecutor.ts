import type { AiProvider } from "./AiProvider";
import type { AiPromptExecutionRequest } from "./AiPromptExecutionRequest";
import type { AiPromptExecutionResponse } from "./AiPromptExecutionResponse";
import type { AiPromptExecutor } from "./AiPromptExecutor";

export class DefaultAiPromptExecutor implements AiPromptExecutor {
  constructor(private readonly aiProvider: AiProvider) {}

  async execute(
    request: AiPromptExecutionRequest,
  ): Promise<AiPromptExecutionResponse> {
    const response = await this.aiProvider.complete({
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
    });

    return {
      text: response.text,
      metadata: response.metadata,
    };
  }
}
