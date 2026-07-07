export class AIError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AIError";
  }
}

export class AIAuthenticationError extends AIError {
  constructor(cause?: unknown) {
    super("AI provider authentication failed. Check ANTHROPIC_API_KEY.", {
      cause,
    });
    this.name = "AIAuthenticationError";
  }
}

export class AIProviderError extends AIError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "AIProviderError";
  }
}
