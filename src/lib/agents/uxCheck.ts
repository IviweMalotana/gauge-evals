import type { AgentContext, UxCheckResult } from "./types";

/**
 * UX-check agent.
 *
 * Responsibilities:
 *  - Classify the request as BUG or FEATURE.
 *  - For a BUG: attempt to reproduce by driving the app (Playwright / a browser
 *    MCP). Capture the steps and screenshots.
 *  - For a FEATURE: investigate the relevant part of the app/code and note how
 *    the new behavior fits.
 *
 * This is a structured STUB: the classification is heuristic and the browser
 * driving is simulated. The interface and persisted shape are real, so wiring
 * Playwright/MCP later is a drop-in replacement for the body of this function.
 */
export async function runUxCheck(ctx: AgentContext): Promise<UxCheckResult> {
  const { title, description } = ctx.request;
  const text = `${title}\n${description}`.toLowerCase();

  const bugSignals = [
    "bug",
    "broken",
    "error",
    "crash",
    "not working",
    "doesn't work",
    "does not work",
    "fails",
    "failing",
    "regression",
    "500",
    "404",
    "exception",
    "cannot",
    "can't",
  ];
  const isBug = bugSignals.some((s) => text.includes(s));

  await ctx.log(
    `Classified request as ${isBug ? "BUG" : "FEATURE"} from intake text.`
  );

  if (isBug) {
    // TODO(playwright): launch a browser, navigate the app, replay the steps
    // described in the request, and assert the failure. Capture screenshots.
    const steps = [
      "Launch app in a headless browser session",
      `Attempt to reproduce: "${title}"`,
      "Observe reported failure condition",
      "Capture screenshot of failing state",
    ];
    await ctx.log("Simulated bug reproduction run (Playwright stub).", { steps });
    return {
      classifiedType: "BUG",
      reproduced: true,
      summary: `Reproduced the reported issue by walking through the described flow. The failure is observable and confirmed.`,
      steps,
      screenshots: ["/artifacts/stub/repro-before.png"],
    };
  }

  // TODO(codebase): read the relevant modules to ground the feature in reality.
  const steps = [
    "Locate the area of the product the request touches",
    "Review current behavior and adjacent flows",
    "Identify the user-facing gap the feature fills",
  ];
  await ctx.log("Simulated feature investigation (codebase-read stub).", { steps });
  return {
    classifiedType: "FEATURE",
    reproduced: false,
    summary: `Request is a new capability rather than a defect. Investigated the surrounding flows to understand where it fits from a user's perspective.`,
    steps,
    screenshots: [],
  };
}
