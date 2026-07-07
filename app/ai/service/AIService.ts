import type { LLMProvider } from "../provider/LLMProvider";
import type { AIResponseStream } from "../model/AIResponse";
import { LEGAL_QA_SYSTEM_PROMPT } from "../prompt/legalQaPrompt";

export class AIService {
  constructor(private readonly provider: LLMProvider) {}

  answerLegalQuestion(question: string): AIResponseStream {
    return this.provider.streamCompletion({
      system: LEGAL_QA_SYSTEM_PROMPT,
      prompt: question,
    });
  }
}
