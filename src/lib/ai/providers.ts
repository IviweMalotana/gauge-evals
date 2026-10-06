/**
 * AI provider abstraction.
 *
 * The platform must not hard-code one model. Agents (BA, UX, QA, Impact, …)
 * request an `AiCompletion` from the provider that owns the configured
 * `provider:model` for their role, so swapping Anthropic for OpenAI, Google,
 * or a local model is a config change — not a rewrite of every agent.
 *
 * - `pickModel(role)` resolves a role to `provider:model` using the
 *   company's `modelRouting` JSON, falling back to the env default.
 * - `getProvider(name)` returns the adapter for a provider name.
 * - `complete({...})` is what agents call. Each adapter implements it.
 *
 * Only the Anthropic adapter ships today. The `openai` and `google` entries
 * are declared as stubs so a human only has to add a client and swap the
 * stub body — not touch any agent.
 */

import { completeJson, completeText } from "../anthropic";
import { env } from "../env";
import type { AgentRole } from "../domain";

export type ProviderName = "anthropic" | "openai" | "google";

export interface AiCompletionRequest {
  system?: string;
  user: string;
  maxTokens?: number;
  // When set, the provider is asked to return a single JSON object matching
  // this (free-form) description. The adapter will coerce to JSON.
  jsonShape?: string;
}

export interface AiProvider {
  name: ProviderName;
  completeText(req: AiCompletionRequest, model: string): Promise<string>;
  completeJson<T>(req: AiCompletionRequest, model: string): Promise<T>;
}

const anthropic: AiProvider = {
  name: "anthropic",
  async completeText(req, _model) {
    return completeText({
      system: req.system ?? "",
      user: req.user,
      maxTokens: req.maxTokens,
    });
  },
  async completeJson<T>(req: AiCompletionRequest, _model: string): Promise<T> {
    const obj = await completeJson({
      system: req.system ?? "",
      user: req.user,
      maxTokens: req.maxTokens,
    });
    return obj as T;
  },
};

const stub = (name: ProviderName): AiProvider => ({
  name,
  async completeText() {
    throw new Error(
      `${name} provider is declared but no adapter is implemented yet. ` +
        `See src/lib/ai/providers.ts.`
    );
  },
  async completeJson() {
    throw new Error(
      `${name} provider is declared but no adapter is implemented yet. ` +
        `See src/lib/ai/providers.ts.`
    );
  },
});

const providers: Record<ProviderName, AiProvider> = {
  anthropic,
  openai: stub("openai"),
  google: stub("google"),
};

export function getProvider(name: ProviderName): AiProvider {
  return providers[name];
}

export interface Resolved {
  provider: ProviderName;
  model: string;
}

/**
 * Resolve a `provider:model` string from the company's routing config.
 * Falls back to the global default (`ANTHROPIC_MODEL`) when nothing is set.
 */
export function pickModel(
  role: AgentRole,
  routingJson: string | null | undefined
): Resolved {
  const routing = parseRouting(routingJson);
  const raw = routing[role];
  if (raw && raw.includes(":")) {
    const [provider, ...rest] = raw.split(":");
    const model = rest.join(":");
    if (isProviderName(provider) && model) {
      return { provider, model };
    }
  }
  return { provider: "anthropic", model: env.ANTHROPIC_MODEL };
}

function parseRouting(json: string | null | undefined): Partial<Record<AgentRole, string>> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function isProviderName(name: string): name is ProviderName {
  return name === "anthropic" || name === "openai" || name === "google";
}

/**
 * Agent entry point. Chooses the provider+model for `role` and runs the
 * completion. Used instead of calling `anthropic.ts` directly, so model
 * routing stays declarative.
 */
export async function runAgentJson<T>(opts: {
  role: AgentRole;
  routing: string | null | undefined;
  req: AiCompletionRequest;
}): Promise<T> {
  const picked = pickModel(opts.role, opts.routing);
  return getProvider(picked.provider).completeJson<T>(opts.req, picked.model);
}

export async function runAgentText(opts: {
  role: AgentRole;
  routing: string | null | undefined;
  req: AiCompletionRequest;
}): Promise<string> {
  const picked = pickModel(opts.role, opts.routing);
  return getProvider(picked.provider).completeText(opts.req, picked.model);
}
