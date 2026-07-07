import { promises as fs } from "fs";
import path from "path";
import type { Browser, Page, Locator } from "playwright-core";
import { completeJson, getAnthropic } from "../anthropic";
import { features } from "../env";
import { CHROMIUM_LAUNCH, chromiumExecutablePath } from "./chromium";

/**
 * A small LLM-driven browser executor: given a natural-language scenario and a
 * base URL, Claude plans a concrete list of browser steps, and Playwright
 * performs them like a human would (navigate, click, type, assert). Returns a
 * pass/fail verdict with the steps taken and a screenshot.
 *
 * This is the shared primitive behind the acceptance tester, the bug-fix
 * reviewer, and the regression sweep.
 */

export interface BrowserStep {
  action: "goto" | "click" | "fill" | "expectText" | "expectNoError";
  target?: string; // path for goto; human-visible label/text otherwise
  value?: string; // text to type for fill
}

export interface ScenarioResult {
  scenario: string;
  passed: boolean;
  detail: string;
  steps: string[]; // human-readable log of what was attempted
  consoleErrors: string[];
  screenshot: string | null;
}

const PLAN_SYSTEM = `You convert a single test scenario into concrete browser steps a tool will
execute with Playwright against a web app. Use ONLY human-visible text for
targets — button labels, link text, field labels or placeholders, and visible
copy to assert. Do not use CSS/XPath selectors.

Allowed actions:
- goto     { "action":"goto", "target":"/path" }
- click    { "action":"click", "target":"Visible button or link text" }
- fill     { "action":"fill", "target":"Field label or placeholder", "value":"text" }
- expectText { "action":"expectText", "target":"Text that should be visible" }
- expectNoError { "action":"expectNoError" }

Reply with a single JSON object only: { "steps": BrowserStep[] }.
Start with a goto. Keep it under 10 steps. End with at least one expectText or
expectNoError that captures the scenario's "Then".`;

async function planSteps(scenario: string, baseUrl: string): Promise<BrowserStep[]> {
  const json = await completeJson({
    system: PLAN_SYSTEM,
    user: `Base URL: ${baseUrl}\n\nScenario:\n${scenario}\n\nReturn the steps as JSON.`,
    maxTokens: 900,
  });
  const steps = Array.isArray(json.steps) ? (json.steps as BrowserStep[]) : [];
  return steps.filter((s) => s && typeof s.action === "string").slice(0, 12);
}

/** Whether the executor can run for real (needs a key to plan the steps). */
export function canDriveBrowser(): boolean {
  return Boolean(features.anthropic && getAnthropic());
}

export async function runScenario(
  baseUrl: string,
  scenario: string,
  requestId: string,
  tag: string
): Promise<ScenarioResult> {
  const log: string[] = [];
  const consoleErrors: string[] = [];
  let browser: Browser | null = null;

  try {
    const steps = await planSteps(scenario, baseUrl);
    if (steps.length === 0) throw new Error("No steps planned");

    // Lazy import so playwright-core isn't pulled into the server startup graph.
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({
      ...CHROMIUM_LAUNCH,
      executablePath: chromiumExecutablePath(),
    });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

    let failed: string | null = null;
    for (const step of steps) {
      try {
        await runStep(page, baseUrl, step, consoleErrors);
        log.push(describe(step));
      } catch (err) {
        failed = `${describe(step)} → ${(err as Error).message}`;
        log.push(`✗ ${failed}`);
        break;
      }
    }

    const screenshot = await capture(page, requestId, tag);
    const passed = failed === null;
    return {
      scenario,
      passed,
      detail: passed ? "All steps and assertions passed." : failed!,
      steps: log,
      consoleErrors,
      screenshot,
    };
  } catch (err) {
    return {
      scenario,
      passed: false,
      detail: `Could not run scenario: ${(err as Error).message}`,
      steps: log,
      consoleErrors,
      screenshot: null,
    };
  } finally {
    await browser?.close().catch(() => null);
  }
}

async function runStep(
  page: Page,
  baseUrl: string,
  step: BrowserStep,
  consoleErrors: string[]
): Promise<void> {
  const T = 8000;
  switch (step.action) {
    case "goto": {
      const url = (step.target ?? "/").startsWith("http")
        ? step.target!
        : baseUrl.replace(/\/+$/, "") + "/" + (step.target ?? "").replace(/^\/+/, "");
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} at ${url}`);
      return;
    }
    case "click":
      await (await clickTarget(page, step.target ?? "")).click({ timeout: T });
      await page.waitForLoadState("domcontentloaded").catch(() => null);
      return;
    case "fill":
      await (await fillTarget(page, step.target ?? "")).fill(step.value ?? "", { timeout: T });
      return;
    case "expectText":
      await page
        .getByText(step.target ?? "", { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: T });
      return;
    case "expectNoError":
      if (consoleErrors.length > 0) throw new Error(`${consoleErrors.length} console/page error(s)`);
      return;
  }
}

// Prefer interactive elements (buttons/links) so we don't accidentally "click"
// a heading or paragraph that merely contains the same text.
async function clickTarget(page: Page, name: string): Promise<Locator> {
  const interactive = page
    .getByRole("button", { name, exact: false })
    .or(page.getByRole("link", { name, exact: false }));
  if ((await interactive.count()) > 0) return interactive.first();
  return page.getByText(name, { exact: false }).first();
}

function fillTarget(page: Page, name: string): Promise<Locator> {
  const field = page
    .getByLabel(name, { exact: false })
    .or(page.getByPlaceholder(name, { exact: false }))
    .or(page.getByRole("textbox", { name, exact: false }));
  return Promise.resolve(field.first());
}

function describe(s: BrowserStep): string {
  switch (s.action) {
    case "goto":
      return `Navigate to ${s.target ?? "/"}`;
    case "click":
      return `Click "${s.target}"`;
    case "fill":
      return `Type "${s.value}" into "${s.target}"`;
    case "expectText":
      return `Expect to see "${s.target}"`;
    case "expectNoError":
      return "Expect no errors";
  }
}

async function capture(page: Page, requestId: string, tag: string): Promise<string | null> {
  try {
    const safe = tag.replace(/[^a-z0-9-]/gi, "_");
    const dir = path.join(process.cwd(), "public", "artifacts", requestId);
    await fs.mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${safe}.png`), fullPage: true });
    return `/artifacts/${requestId}/${safe}.png`;
  } catch {
    return null;
  }
}
