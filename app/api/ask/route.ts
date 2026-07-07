import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a general legal information assistant. You answer from general " +
  "knowledge only — you have no access to statutes, case law, or any " +
  "retrieval system. Never claim to cite a specific law, case, or section " +
  "number as if verified. If precise legal authority is needed, tell the " +
  "user to verify with a licensed attorney or primary source. Keep answers " +
  "concise.";

export async function POST(req: Request) {
  const { question } = await req.json();

  if (typeof question !== "string" || question.trim().length === 0) {
    return new Response("Missing question", { status: 400 });
  }

  const client = new Anthropic();

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: question }],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
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
