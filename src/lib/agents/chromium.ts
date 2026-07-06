import { existsSync } from "fs";

/**
 * Resolve the Chromium executable for Playwright across environments:
 *
 *  1. An explicit path via PLAYWRIGHT_EXECUTABLE_PATH / CHROMIUM_PATH.
 *  2. The pre-installed browser in this dev sandbox, if present.
 *  3. Otherwise `undefined` — let Playwright use its managed browser. In
 *     production we build from the official Playwright Docker image, which ships
 *     Chromium + system libraries, so this resolves there.
 */
export function chromiumExecutablePath(): string | undefined {
  const explicit = process.env.PLAYWRIGHT_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;
  if (explicit) return explicit;
  const sandbox = "/opt/pw-browsers/chromium";
  if (existsSync(sandbox)) return sandbox;
  return undefined;
}

/** Launch options that are safe inside containers (root, small /dev/shm). */
export const CHROMIUM_LAUNCH = {
  headless: true as const,
  chromiumSandbox: false as const,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
};
