import Anthropic from "@anthropic-ai/sdk";
import { env, features } from "./env";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (!features.anthropic) return null;
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Ask Claude for a single JSON object matching the caller's shape. We instruct
 * the model to reply with JSON only, then defensively extract the first {...}
 * block in case it wraps the response in prose or fences.
 */
export async function completeJson(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<Record<string, unknown>> {
  const anthropic = getAnthropic();
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const res = await anthropic.messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 2000,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

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
