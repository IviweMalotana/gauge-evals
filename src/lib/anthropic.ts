import https from "https";
import { env, features } from "./env";

/**
 * Anthropic client over RAW node:https.
 *
 * On the production host, calls made through fetch (the SDK's transport) died
 * with ERR_STREAM_PREMATURE_CLOSE — with and without SDK streaming. Next.js
 * patches the global fetch (undici), and stale keep-alive sockets / the patched
 * fetch are known sources of exactly that failure. This client sidesteps the
 * whole layer: a fresh TLS connection per request (agent: false), the SSE
 * stream parsed by hand, and retries on connection-level failures.
 */

const API_HOST = "api.anthropic.com";
const API_PATH = "/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Gate used by the agents: truthy when an API key is configured. (Kept for
 * call-site compatibility with the previous SDK-based client.)
 */
export function getAnthropic(): { ready: true } | null {
  return features.anthropic ? { ready: true } : null;
}

export class AnthropicHttpError extends Error {
  constructor(
    public status: number,
    body: string
  ) {
    super(`Anthropic ${status}: ${body.slice(0, 300)}`);
    this.name = "AnthropicHttpError";
  }
}

interface StreamArgs {
  system?: string;
  user: string;
  maxTokens?: number;
}

/** One streamed /v1/messages call over raw https. Resolves to the full text. */
function rawStreamOnce(args: StreamArgs): Promise<string> {
  const payload = JSON.stringify({
    model: env.ANTHROPIC_MODEL,
    max_tokens: args.maxTokens ?? 2000,
    ...(args.system ? { system: args.system } : {}),
    messages: [{ role: "user", content: args.user }],
    stream: true,
  });

  return new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        host: API_HOST,
        path: API_PATH,
        method: "POST",
        // Fresh connection per request — no shared keep-alive pool to go stale.
        agent: false,
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
          accept: "text/event-stream",
          "content-length": Buffer.byteLength(payload),
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        res.setEncoding("utf8");

        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (c: string) => (errBody += c));
          res.on("end", () => reject(new AnthropicHttpError(res.statusCode ?? 0, errBody)));
          res.on("error", reject);
          return;
        }

        let buffer = "";
        let text = "";
        let streamErr: Error | null = null;

        res.on("data", (chunk: string) => {
          buffer += chunk;
          // SSE events are separated by blank lines; process complete lines.
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const evt = JSON.parse(data) as {
                type?: string;
                delta?: { type?: string; text?: string };
                error?: { type?: string; message?: string };
              };
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                text += evt.delta.text ?? "";
              } else if (evt.type === "error") {
                streamErr = new Error(
                  `Anthropic stream error: ${evt.error?.type ?? "unknown"} ${evt.error?.message ?? ""}`
                );
              }
            } catch {
              // ignore unparseable keep-alive/comment lines
            }
          }
        });
        res.on("end", () => (streamErr ? reject(streamErr) : resolve(text.trim())));
        res.on("error", reject);
      }
    );

    req.on("timeout", () => req.destroy(new Error("Anthropic request timed out")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/** Connection-level failures worth retrying (vs. real API errors, which aren't). */
function isRetryable(err: unknown): boolean {
  if (err instanceof AnthropicHttpError) {
    return err.status === 429 || err.status >= 500;
  }
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  const code = String((err as { code?: string })?.code ?? "");
  return (
    msg.includes("premature close") ||
    msg.includes("socket hang up") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    ["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"].includes(code)
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Full text of a Claude response, with retries on connection failures. */
export async function completeText(args: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  if (!features.anthropic) throw new Error("ANTHROPIC_API_KEY not configured");

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await rawStreamOnce(args);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_ATTEMPTS || !isRetryable(err)) throw err;
      await sleep(500 * attempt);
    }
  }
  throw lastErr;
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
