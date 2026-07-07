import type { AIResponseStream } from "../model/AIResponse";

export interface LLMCompletionRequest {
  system: string;
  prompt: string;
}

export interface LLMProvider {
  streamCompletion(request: LLMCompletionRequest): AIResponseStream;
}
