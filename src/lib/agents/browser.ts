import { promises as fs } from "fs";
import path from "path";
import { chromium, type Browser } from "playwright-core";
import { CHROMIUM_LAUNCH, chromiumExecutablePath } from "./chromium";

/**
 * Real browser automation for the UX-check agent. We launch Chromium, drive it
 * to the target URL, and collect observable signals (HTTP status, console/page
 * errors, error-like page text) plus a screenshot artifact.
 *
 * This is deliberately a *general* reproduction pass rather than a full
 * autonomous repro agent: it produces real, honest evidence about the page the
 * bug was reported on. A future version can replay request-specific steps.
 */

export interface BrowserObservation {
  url: string;
  ok: boolean;
  status: number | null;
  title: string | null;
  consoleErrors: string[];
  pageErrors: string[];
  errorTextFound: boolean;
  screenshotWebPath: string | null;
  steps: string[];
  error?: string;
}

const ERROR_TEXT = [
  "internal server error",
  "something went wrong",
  "unexpected error",
  "application error",
  "500",
  "does not exist",
  "not found",
];

export async function reproduceInBrowser(
  targetUrl: string,
  requestId: string
): Promise<BrowserObservation> {
  const steps: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let browser: Browser | null = null;

  try {
    steps.push("Launch headless Chromium");
    browser = await chromium.launch({
      ...CHROMIUM_LAUNCH,
      executablePath: chromiumExecutablePath(),
    });

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // mobile-ish, matches many reports
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Baton-UXCheck",
    });
    const page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 300)));

    steps.push(`Navigate to ${targetUrl}`);
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const status = response?.status() ?? null;
    const title = await page.title().catch(() => null);

    steps.push("Wait for the page to settle");
    await page.waitForTimeout(1500);

    const bodyText = (await page.locator("body").innerText().catch(() => "")) || "";
    const lower = bodyText.toLowerCase();
    const errorTextFound = ERROR_TEXT.some((t) => lower.includes(t));

    // Persist a screenshot artifact under /public so it's web-servable.
    steps.push("Capture screenshot");
    const dir = path.join(process.cwd(), "public", "artifacts", requestId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "repro.png");
    await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
    const screenshotWebPath = `/artifacts/${requestId}/repro.png`;

    const ok = status !== null && status < 400;
    return {
      url: targetUrl,
      ok,
      status,
      title,
      consoleErrors,
      pageErrors,
      errorTextFound,
      screenshotWebPath,
      steps,
    };
  } catch (err) {
    return {
      url: targetUrl,
      ok: false,
      status: null,
      title: null,
      consoleErrors,
      pageErrors,
      errorTextFound: false,
      screenshotWebPath: null,
      steps,
      error: (err as Error).message,
    };
  } finally {
    await browser?.close().catch(() => null);
  }
}

/** Pull the first http(s) URL out of free text, if any. */
export function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)"'<>]+/i);
  return m ? m[0] : null;
}
