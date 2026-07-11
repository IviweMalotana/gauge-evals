import { completeText, getAnthropic } from "../anthropic";
import { features } from "../env";
import { getFile, type GhClient } from "../github";
import { searchRequirements } from "../requirements/store";
import type { AgentContext, BuildResult } from "./types";

/**
 * UI fixer / conformance check (Phase 4b).
 *
 * After a build changes UI files, check them against the design-system rules
 * extracted in Phase 4a (the `requirements/design/*` corpus). It surfaces
 * conformance VIOLATIONS — e.g. "a card must use the .card class" — as
 * non-blocking warnings appended to the build summary and log, the same way the
 * duplicate-copy guard does. It never fails the pipeline; a human sees the
 * flags on the PR and decides.
 */

const UI_SYSTEM = `You are a UI reviewer enforcing a design system. You are given the design
component RULES (extracted from this codebase) and the CURRENT contents of UI
files a change touched. Report only CLEAR violations of the stated rules that
are visible in the given file contents — do not speculate about runtime or other
files, and do not invent rules that weren't given.

For each violation, name the file, the rule it breaks, what's wrong, and a
concrete fix.

Reply with a SINGLE JSON object only:
{ "violations": [ { "file": string, "rule": string, "detail": string, "fix": string } ] }`;

export interface UiViolation {
  file: string;
  rule: string;
  detail: string;
  fix: string;
}

export interface ConformanceResult {
  checkedFiles: string[];
  violations: UiViolation[];
}

const UI_EXT = /\.(tsx|jsx|vue|svelte|css|scss|html)$/i;
const MAX_RULES = 40;
const MAX_FILES = 6;
const MAX_FILE_CHARS = 4000;

/** The UI files a build changed (design conformance only applies to these). */
export function changedUiFiles(filesChanged: string[]): string[] {
  return filesChanged.filter((f) => UI_EXT.test(f)).slice(0, MAX_FILES);
}

/**
 * Pull the enforceable rule lines out of a design requirement's Gherkin body —
 * the "Then" steps of its "Conformance rules" (and structure) scenarios. Pure.
 */
export function extractRuleLines(body: string): string[] {
  const rules: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^(Then|And)\s+(.*)$/);
    if (m && m[2]) rules.push(m[2].trim());
  }
  return rules;
}

/**
 * Normalize the model's raw violation list: coerce fields, drop entries with no
 * detail or referencing a file that wasn't part of the change. Pure.
 */
export function parseConformanceReport(raw: unknown, changedFiles: string[]): UiViolation[] {
  const list = Array.isArray(raw) ? raw : [];
  const allowed = new Set(changedFiles);
  const out: UiViolation[] = [];
  for (const v of list) {
    const o = v as Partial<UiViolation>;
    const file = typeof o.file === "string" ? o.file.trim() : "";
    const detail = typeof o.detail === "string" ? o.detail.trim() : "";
    if (!detail) continue;
    // Keep only violations tied to a file that was actually changed.
    if (file && !allowed.has(file)) continue;
    out.push({
      file: file || changedFiles[0] || "",
      rule: typeof o.rule === "string" ? o.rule.trim() : "",
      detail,
      fix: typeof o.fix === "string" ? o.fix.trim() : "",
    });
  }
  return out;
}

/** Format violations as human-readable warning lines. Pure. */
export function formatConformanceWarnings(violations: UiViolation[]): string[] {
  return violations.map(
    (v) => `${v.file}: ${v.detail}${v.rule ? ` (rule: ${v.rule})` : ""}${v.fix ? ` → ${v.fix}` : ""}`
  );
}

/**
 * Run the design conformance check for a build. Returns null when there's
 * nothing to check (no design corpus, no changed UI files, or no key).
 */
export async function checkUiConformance(
  ctx: AgentContext,
  build: BuildResult
): Promise<ConformanceResult | null> {
  if (!features.anthropic || !getAnthropic() || !ctx.githubToken || !ctx.repo) return null;
  if (!build.committed) return null;

  const files = changedUiFiles(build.filesChanged);
  if (files.length === 0) return null;

  const designDocs = await searchRequirements(ctx.request.companyId, {
    categories: ["design"],
    limit: 50,
  });
  if (designDocs.length === 0) {
    await ctx.log("No design system extracted yet — skipping UI conformance (extract it in Settings).");
    return null;
  }

  const rules: string[] = [];
  for (const d of designDocs) {
    for (const r of extractRuleLines(d.body)) rules.push(`[${d.title}] ${r}`);
    if (rules.length >= MAX_RULES) break;
  }
  const ruleList = rules.slice(0, MAX_RULES);
  if (ruleList.length === 0) return null;

  const client: GhClient = { token: ctx.githubToken, repo: ctx.repo };
  const contents: { path: string; contents: string }[] = [];
  for (const path of files) {
    const file = await getFile(client, path, build.branch);
    if (file) contents.push({ path, contents: file.contents.slice(0, MAX_FILE_CHARS) });
  }
  if (contents.length === 0) return null;

  await ctx.log(`Checking ${contents.length} changed UI file(s) against ${ruleList.length} design rule(s).`);

  const text = await completeText({
    system: UI_SYSTEM,
    user: `Design component rules:
${ruleList.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Changed UI files (current contents):
${contents.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Report clear violations as JSON.`,
    maxTokens: 1500,
  });

  let raw: unknown = [];
  try {
    const obj = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as {
      violations?: unknown;
    };
    raw = obj.violations ?? [];
  } catch {
    raw = [];
  }

  const violations = parseConformanceReport(raw, files);
  await ctx.log(
    violations.length
      ? `UI conformance: ${violations.length} possible violation(s) — review before merge.`
      : "UI conformance: no violations found.",
    violations.length ? { violations: formatConformanceWarnings(violations) } : undefined
  );
  return { checkedFiles: files, violations };
}
