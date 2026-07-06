import { completeJson } from "../anthropic";
import { reproduceInBrowser } from "./browser";
import { runScenario } from "./browserAgent";
import type { AgentContext, BrdResult } from "./types";

/**
 * The verification agents that run after a build, each driving a real browser
 * against the running app:
 *
 *  - acceptanceTest   — performs the approved acceptance criteria as human
 *                       actions (click/type/assert) and checks each one.
 *  - bugFixReview     — for bugs, re-runs the original reproduction and
 *                       confirms the failure is gone.
 *  - regressionSweep  — exercises core/adjacent flows and flags NEW errors.
 */

export interface CheckReport {
  label: string;
  passed: boolean;
  lines: string[];
  screenshots: string[];
}

const MAX_ACCEPTANCE = 5;
const MAX_REGRESSION = 3;

/** Perform each acceptance criterion as real browser actions. */
export async function acceptanceTest(
  ctx: AgentContext,
  brd: BrdResult,
  url: string
): Promise<CheckReport> {
  const criteria = brd.acceptanceCriteria.slice(0, MAX_ACCEPTANCE);
  const lines: string[] = [];
  const screenshots: string[] = [];
  let allPassed = true;

  for (let i = 0; i < criteria.length; i++) {
    const scenario = `${criteria[i]}\n\nContext (Gherkin):\n${brd.gherkin}`;
    const r = await runScenario(url, scenario, ctx.request.id, `acceptance-${i + 1}`);
    allPassed = allPassed && r.passed;
    lines.push(`${r.passed ? "PASS" : "FAIL"}  ${criteria[i]} — ${r.detail}`);
    if (r.screenshot) screenshots.push(r.screenshot);
  }

  return { label: "Acceptance (UX)", passed: allPassed && criteria.length > 0, lines, screenshots };
}

/** Re-run the reported reproduction; a bug is "fixed" if the signals are gone. */
export async function bugFixReview(ctx: AgentContext, url: string): Promise<CheckReport> {
  const obs = await reproduceInBrowser(url, `${ctx.request.id}-fixcheck`);
  const signals: string[] = [];
  if (obs.status !== null && obs.status >= 400) signals.push(`HTTP ${obs.status}`);
  if (obs.consoleErrors.length) signals.push(`${obs.consoleErrors.length} console error(s)`);
  if (obs.pageErrors.length) signals.push(`${obs.pageErrors.length} page error(s)`);
  if (obs.errorTextFound) signals.push("error text on page");

  const passed = obs.error ? false : signals.length === 0;
  const line = obs.error
    ? `FAIL  Could not verify — ${obs.error}`
    : passed
      ? `PASS  The reported failure no longer reproduces at ${url}.`
      : `FAIL  Failure signals still present: ${signals.join(", ")}.`;

  return {
    label: "Bug fix verification",
    passed,
    lines: [line],
    screenshots: obs.screenshotWebPath ? [obs.screenshotWebPath] : [],
  };
}

/** Ask Claude for a few adjacent/core flows, then check they still work. */
export async function regressionSweep(
  ctx: AgentContext,
  brd: BrdResult,
  url: string
): Promise<CheckReport> {
  let scenarios: string[] = [];
  try {
    const json = await completeJson({
      system: `You propose short regression checks: core or adjacent user flows that should
STILL work after an unrelated change, to catch breakage. Each is one plain
sentence a tester can perform in a browser. Reply JSON: { "scenarios": string[] } (max 3).`,
      user: `The change being made:\n${ctx.request.title} — ${ctx.request.description}\n\nAcceptance criteria:\n${brd.acceptanceCriteria.join(
        "\n"
      )}\n\nPropose up to 3 regression checks for flows that should remain unaffected.`,
      maxTokens: 500,
    });
    scenarios = Array.isArray(json.scenarios)
      ? (json.scenarios as unknown[]).map(String).slice(0, MAX_REGRESSION)
      : [];
  } catch {
    scenarios = ["Load the home page and main navigation; nothing should error."];
  }
  if (scenarios.length === 0) {
    scenarios = ["Load the home page and main navigation; nothing should error."];
  }

  const lines: string[] = [];
  const screenshots: string[] = [];
  let allPassed = true;
  for (let i = 0; i < scenarios.length; i++) {
    const r = await runScenario(url, scenarios[i], ctx.request.id, `regression-${i + 1}`);
    allPassed = allPassed && r.passed;
    lines.push(`${r.passed ? "PASS" : "FAIL"}  ${scenarios[i]} — ${r.detail}`);
    if (r.screenshot) screenshots.push(r.screenshot);
  }

  return { label: "Regression", passed: allPassed, lines, screenshots };
}
