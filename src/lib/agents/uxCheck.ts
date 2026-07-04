import type { AgentContext, UxCheckResult } from "./types";
import { extractUrl, reproduceInBrowser } from "./browser";

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
    // Prefer a URL mentioned in the request; otherwise use the company's app.
    const targetUrl = extractUrl(`${title}\n${description}`) ?? ctx.appBaseUrl ?? null;

    if (targetUrl) {
      await ctx.log(`Driving the app in a headless browser at ${targetUrl}.`);
      const obs = await reproduceInBrowser(targetUrl, ctx.request.id);

      if (obs.error) {
        // The browser pass itself failed to reach the app — report honestly
        // rather than claiming a reproduction.
        await ctx.log(`Browser pass could not complete: ${obs.error}`, obs);
        return {
          classifiedType: "BUG",
          reproduced: false,
          summary: `Attempted to reproduce by loading ${targetUrl}, but the browser pass failed (${obs.error}). A human should confirm the environment is reachable.`,
          steps: obs.steps,
          screenshots: [],
        };
      }

      const signals: string[] = [];
      if (obs.status !== null && obs.status >= 400) signals.push(`HTTP ${obs.status}`);
      if (obs.consoleErrors.length) signals.push(`${obs.consoleErrors.length} console error(s)`);
      if (obs.pageErrors.length) signals.push(`${obs.pageErrors.length} page error(s)`);
      if (obs.errorTextFound) signals.push("error text on page");
      const reproduced = signals.length > 0;

      await ctx.log(
        reproduced
          ? `Observed failure signals: ${signals.join(", ")}.`
          : "Loaded the page cleanly; no obvious failure signals from a general pass.",
        obs
      );

      return {
        classifiedType: "BUG",
        reproduced,
        summary: reproduced
          ? `Drove the app at ${targetUrl} and observed failure signals (${signals.join(
              ", "
            )}). Screenshot captured for review.`
          : `Drove the app at ${targetUrl} (HTTP ${obs.status ?? "?"}, "${
              obs.title ?? ""
            }") but a general pass surfaced no obvious error. The specific reported steps may need a human to replay; screenshot captured.`,
        steps: obs.steps,
        screenshots: obs.screenshotWebPath ? [obs.screenshotWebPath] : [],
      };
    }

    // No target URL available — record that we couldn't drive anything.
    await ctx.log(
      "No target URL on the request and no company app URL set — skipping browser reproduction."
    );
    return {
      classifiedType: "BUG",
      reproduced: false,
      summary: `Classified as a bug, but there's no app URL to drive. Set the company's app URL in Settings (or include a link in the request) so the UX-check agent can reproduce it in a browser.`,
      steps: [
        "Classify request as a bug",
        "Look for a URL to drive — none found",
      ],
      screenshots: [],
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
