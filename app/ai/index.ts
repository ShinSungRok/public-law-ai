import { AIService } from "./service/AIService";
import { AnthropicProvider } from "./provider/AnthropicProvider";
import { loadAIConfig } from "./config/aiConfig";

export function createAIService(): AIService {
  const config = loadAIConfig();
  const provider = new AnthropicProvider(config);
  return new AIService(provider);
}
