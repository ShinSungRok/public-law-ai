export interface AIConfig {
  model: string;
  maxTokens: number;
}

const DEFAULT_MODEL = "claude-opus-4-8";
const DEFAULT_MAX_TOKENS = 1024;

function parseMaxTokens(value: string | undefined): number {
  if (!value) {
    return DEFAULT_MAX_TOKENS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_TOKENS;
  }

  return Math.floor(parsed);
}

export function loadAIConfig(): AIConfig {
  return {
    model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    maxTokens: parseMaxTokens(process.env.AI_MAX_TOKENS),
  };
}
