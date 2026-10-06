/**
 * Coding-agent abstraction.
 *
 * The build stage hands an accepted ticket's requirements, Gherkin, build
 * context, and target files to a coding backend. The default backend is the
 * Claude-driven builder already in `src/lib/agents/builder.ts`; routing lets
 * a future Claude Code / OpenAI Codex / local backend slot in without
 * touching the orchestrator.
 */

import type { AgentContext, BuildResult, PlanResult, BrdResult } from "../agents/types";
import { runBuilder } from "../agents/builder";

export interface BuildContext {
  ctx: AgentContext;
  brd: BrdResult;
  plan: PlanResult;
  /** Snapshot of the files the coding agent is allowed to read/change. */
  files?: string[];
  constraints?: string[];
}

export interface CodingAgentProvider {
  name: string;
  build(ctx: BuildContext): Promise<BuildResult>;
}

const claudeBuilder: CodingAgentProvider = {
  name: "claude-builder",
  async build({ ctx, brd, plan }) {
    return runBuilder(ctx, plan, brd);
  },
};

const providers: Record<string, CodingAgentProvider> = {
  "claude-builder": claudeBuilder,
};

/**
 * Resolve a coding-agent provider by name. Falls back to the default when
 * the requested one isn't registered yet.
 */
export function getCodingAgent(name?: string | null): CodingAgentProvider {
  if (name && providers[name]) return providers[name];
  return claudeBuilder;
}
