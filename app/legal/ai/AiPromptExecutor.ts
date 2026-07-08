import type { AiPromptExecutionRequest } from "./AiPromptExecutionRequest";
import type { AiPromptExecutionResponse } from "./AiPromptExecutionResponse";

export interface AiPromptExecutor {
  execute(request: AiPromptExecutionRequest): Promise<AiPromptExecutionResponse>;
}
