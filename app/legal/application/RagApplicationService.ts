import type { RagAnswer } from "../rag/RagAnswer";
import type { GenerateRagAnswerUseCase } from "./GenerateRagAnswerUseCase";

export class RagApplicationService {
  constructor(
    private readonly generateRagAnswerUseCase: GenerateRagAnswerUseCase,
  ) {}

  async answer(query: string): Promise<RagAnswer> {
    return this.generateRagAnswerUseCase.execute(query);
  }
}
