import type { RagAnswerRequestDto } from "../api/RagAnswerRequestDto";
import type { RagController } from "../api/RagController";
import type { HttpHandler } from "./HttpHandler";
import type { HttpRequest } from "./HttpRequest";
import type { HttpResponse } from "./HttpResponse";

export class RagHttpHandler implements HttpHandler {
  constructor(private readonly ragController: RagController) {}

  async handle(request: HttpRequest): Promise<HttpResponse> {
    const requestDto = request.body as RagAnswerRequestDto;
    const responseDto = await this.ragController.answer(requestDto);

    return {
      statusCode: 200,
      headers: {},
      body: responseDto,
    };
  }
}
