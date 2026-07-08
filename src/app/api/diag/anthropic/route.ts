import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth";
import { env, features } from "@/lib/env";
import { getAnthropic } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: makes a tiny streamed call to the Anthropic API and
 * reports exactly what happens — so an "it's not working" turns into a precise
 * cause (bad key = 401, bad model = 404, real network failure, etc.). Never
 * returns the API key; only the error status/message.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can.manageCompany(user.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = {
    keyConfigured: features.anthropic,
    model: env.ANTHROPIC_MODEL,
  };

  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json({ ...base, ok: false, reason: "ANTHROPIC_API_KEY not set" });
  }

  const started = Date.now();
  try {
    const stream = anthropic.messages.stream({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
    });
    const message = await stream.finalMessage();
    const reply = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();
    return NextResponse.json({
      ...base,
      ok: true,
      ms: Date.now() - started,
      reply: reply.slice(0, 60),
      usage: message.usage,
    });
  } catch (err) {
    const e = err as {
      name?: string;
      status?: number;
      message?: string;
      error?: unknown;
      cause?: { message?: string; code?: string };
    };
    return NextResponse.json({
      ...base,
      ok: false,
      ms: Date.now() - started,
      errorName: e?.name ?? null,
      status: e?.status ?? null,
      message: String(e?.message ?? err).slice(0, 500),
      cause: e?.cause ? { message: e.cause.message, code: e.cause.code } : null,
    });
  }
}
