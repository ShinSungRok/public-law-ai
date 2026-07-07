import { AIService } from "./service/AIService";
import { AnthropicProvider } from "./provider/AnthropicProvider";
import { loadAIConfig } from "./config/aiConfig";
import { createKeywordRetriever } from "../legal";

export function createAIService(): AIService {
  const config = loadAIConfig();
  const provider = new AnthropicProvider(config);
  const retriever = createKeywordRetriever();
  return new AIService(provider, retriever);
}
