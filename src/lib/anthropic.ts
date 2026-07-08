import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "./env";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (!features.anthropic) return null;
  if (!client) {
    client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      // Retry transient network failures (including dropped connections).
      maxRetries: 4,
      // Generous ceiling; streaming keeps the connection active well under this.
      timeout: 120_000,
    });
  }
  return client;
}

/**
 * Get the full text of a Claude response, using STREAMING.
 *
 * Non-streaming `messages.create` can fail with "Premature close" when the
 * response takes long enough for an intermediary to drop the idle connection.
 * Streaming reads the body incrementally (SSE), which avoids that and is
 * Anthropic's recommended approach for reliability.
 */
export async function completeText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const anthropic = getAnthropic();
  if (!anthropic) throw new Error("ANTHROPIC_API_KEY not configured");

  const stream = anthropic.messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 2000,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/**
 * Ask Claude for a single JSON object. We instruct the model to reply with JSON
 * only, then defensively extract the first {...} block in case it wraps the
 * response in prose or fences.
 */
export async function completeJson(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const text = await completeText(args);
  return extractJson(text);
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
