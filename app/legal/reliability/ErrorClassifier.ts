import type { ClassifiedError } from "./ClassifiedError";

export interface ErrorClassifier {
  classify(error: unknown): ClassifiedError;
}
