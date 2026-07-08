import { NextResponse } from "next/server";
import { getCurrentUser, can } from "@/lib/auth";
import { env, features } from "@/lib/env";
import { completeText } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * Admin-only diagnostic: makes a tiny call over the SAME transport the agents
 * use (raw node:https, SSE) and reports exactly what happens. Never returns the
 * API key; only the error status/message.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can.manageCompany(user.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const base = {
    keyConfigured: features.anthropic,
    model: env.ANTHROPIC_MODEL,
    transport: "node:https (raw, SSE, no fetch)",
  };

  if (!features.anthropic) {
    return NextResponse.json({ ...base, ok: false, reason: "ANTHROPIC_API_KEY not set" });
  }

  const started = Date.now();
  try {
    const reply = await completeText({
      system: "You are a connectivity check.",
      user: "Reply with the single word: pong",
      maxTokens: 16,
    });
    return NextResponse.json({
      ...base,
      ok: true,
      ms: Date.now() - started,
      reply: reply.slice(0, 60),
    });
  } catch (err) {
    const e = err as {
      name?: string;
      status?: number;
      message?: string;
      code?: string;
      cause?: { message?: string; code?: string };
    };
    return NextResponse.json({
      ...base,
      ok: false,
      ms: Date.now() - started,
      errorName: e?.name ?? null,
      status: e?.status ?? null,
      code: e?.code ?? null,
      message: String(e?.message ?? err).slice(0, 500),
      cause: e?.cause ? { message: e.cause.message, code: e.cause.code } : null,
    });
  }
}
