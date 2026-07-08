import type { ApiErrorResponseDto } from "./ApiErrorResponseDto";
import { InvalidRagRequestError } from "./InvalidRagRequestError";

export class ApiErrorMapper {
  map(error: unknown): ApiErrorResponseDto {
    if (error instanceof InvalidRagRequestError) {
      return {
        code: "INVALID_RAG_REQUEST",
        message: error.message,
      };
    }

    return {
      code: "INTERNAL_SERVER_ERROR",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
