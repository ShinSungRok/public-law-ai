import { createAIService } from "@/app/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { question } = await req.json();

  if (typeof question !== "string" || question.trim().length === 0) {
    return new Response("Missing question", { status: 400 });
  }

  const aiService = createAIService();
  const chunks = aiService.answerLegalQuestion(question);

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk.text));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode("\n\n[Error: failed to generate a response.]"),
        );
        console.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
