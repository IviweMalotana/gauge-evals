/**
 * Release-notes agent.
 *
 * Given a set of DONE requests (each already linked to a BRD + PR + QA
 * evidence), produce three audience-targeted notes:
 *
 *  - user       — simple language, no implementation details
 *  - technical  — concise changelog
 *  - internal   — summary + risks + QA evidence summary for the delivery team
 *
 * Falls back to deterministic templates when no API key is set so the
 * pipeline still runs end-to-end.
 */

import { features, env } from "../env";
import { runAgentJson } from "../ai/providers";
import type { ReleaseAudience } from "../domain";

export interface ReleaseInputTicket {
  requestId: string;
  title: string;
  type: string;
  gherkin: string;
  acceptanceCriteria: string[];
  prUrl?: string;
}

export interface ReleaseNotesResult {
  notes: Record<ReleaseAudience, string>;
  model: string;
}

const SYSTEM = `You write software release notes. Produce three documents for the same
release, each tuned to its audience:

- "user":      Written for ordinary customers. Plain language. No implementation
               details, no file names, no acronyms unless the product already
               uses them. Start with what they can now do.
- "technical": A concise changelog for engineers. Bullet per change, grouped by
               area where possible.
- "internal":  A short note for the delivery team: scope summary, notable risks,
               and whether QA evidence was attached.

Reply with a single JSON object only:
{ "user": string, "technical": string, "internal": string }`;

export async function runReleaseNotes(
  tickets: ReleaseInputTicket[],
  modelRouting: string | null | undefined
): Promise<ReleaseNotesResult> {
  if (!features.anthropic || tickets.length === 0) {
    return { notes: fallback(tickets), model: "fallback" };
  }

  const user = tickets
    .map(
      (t, i) =>
        `#${i + 1} ${t.title} (${t.type})\nPR: ${t.prUrl ?? "n/a"}\nAcceptance:\n- ${t.acceptanceCriteria.join("\n- ")}\n\nGherkin:\n${t.gherkin}`
    )
    .join("\n\n---\n\n");

  try {
    const parsed = await runAgentJson<Record<ReleaseAudience, string>>({
      role: "release",
      routing: modelRouting,
      req: { system: SYSTEM, user, maxTokens: 2000 },
    });
    return {
      notes: {
        user: parsed.user ?? "",
        technical: parsed.technical ?? "",
        internal: parsed.internal ?? "",
      },
      model: env.ANTHROPIC_MODEL,
    };
  } catch {
    return { notes: fallback(tickets), model: "fallback" };
  }
}

function fallback(
  tickets: ReleaseInputTicket[]
): Record<ReleaseAudience, string> {
  const list = tickets.map((t) => `- ${t.title}`).join("\n");
  return {
    user: `What's new\n\n${
      tickets.length === 0
        ? "No customer-visible changes in this release."
        : `This release brings:\n\n${list}`
    }`,
    technical: `Changelog\n\n${list || "(no tickets)"}`,
    internal: `Release summary\n\n${
      tickets.length
    } ticket(s). PRs: ${tickets.map((t) => t.prUrl ?? "n/a").join(", ")}`,
  };
}
