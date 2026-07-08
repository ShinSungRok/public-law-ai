import type { RagApplicationService } from "../application/RagApplicationService";
import { InvalidRagRequestError } from "./InvalidRagRequestError";
import type { RagAnswerRequestDto } from "./RagAnswerRequestDto";
import type { RagAnswerResponseDto } from "./RagAnswerResponseDto";

export class RagController {
  constructor(
    private readonly ragApplicationService: RagApplicationService,
  ) {}

  async answer(
    request: RagAnswerRequestDto,
  ): Promise<RagAnswerResponseDto> {
    if (request.query.trim().length === 0) {
      throw new InvalidRagRequestError("query must not be empty");
    }

    return this.ragApplicationService.answer(request.query);
  }
}
