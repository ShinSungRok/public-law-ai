import type { ClassifiedError } from "./ClassifiedError";
import type { ErrorCategory } from "./ErrorCategory";
import type { ErrorClassifier } from "./ErrorClassifier";

const CATEGORY_BY_ERROR_NAME: Record<string, ErrorCategory> = {
  TimeoutError: "timeout",
  RateLimitExceededError: "rate-limit",
  InputValidationError: "validation",
  DependencyError: "dependency",
};

export class DefaultErrorClassifier implements ErrorClassifier {
  classify(error: unknown): ClassifiedError {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : undefined;
    const category = (name && CATEGORY_BY_ERROR_NAME[name]) || "internal";

    return { category, message, cause: error };
  }
}
