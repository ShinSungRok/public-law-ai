import type { ErrorCategory } from "./ErrorCategory";

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  cause: unknown;
}
