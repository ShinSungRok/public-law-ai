import { DefaultApplicationBootstrapFactory } from "@/app/legal/composition";
import { ProductionServerRuntime } from "@/app/legal/server/ProductionServerRuntime";
import { ApiErrorMapper } from "@/app/legal/api";

export const runtime = "nodejs";

const serverRuntime = new ProductionServerRuntime(
  new DefaultApplicationBootstrapFactory().create(),
);
const errorMapper = new ApiErrorMapper();

async function getRagController() {
  await serverRuntime.start();
  return serverRuntime.getContext().ragController;
}

export async function POST(req: Request) {
  const { question } = await req.json();

  if (typeof question !== "string" || question.trim().length === 0) {
    return new Response("Missing question", { status: 400 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        const ragController = await getRagController();
        const { answer } = await ragController.answer({ query: question });
        controller.enqueue(encoder.encode(answer));
      } catch (err) {
        const mapped = errorMapper.map(err);
        controller.enqueue(encoder.encode(`\n\n[Error: ${mapped.message}]`));
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
