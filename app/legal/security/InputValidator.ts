import type { InputValidationResult } from "./InputValidationResult";

export interface InputValidator {
  validate(input: string): InputValidationResult;
}
