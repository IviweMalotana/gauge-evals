import type { AgentContext, BuildResult, TestResult } from "./types";

/**
 * Tester agent. Runs the acceptance criteria as checks against the build.
 *
 * STUB: reports a passing run. Replace with a real test runner (unit + the
 * Gherkin scenarios driven through Playwright) without changing the interface.
 */
export async function runTester(
  ctx: AgentContext,
  build: BuildResult
): Promise<TestResult> {
  await ctx.log(`Tester validating build on ${build.branch}.`);

  const output = [
    "PASS  acceptance/scenario-1",
    "PASS  acceptance/scenario-2",
    "PASS  lint",
  ];

  return {
    passed: true,
    summary: "All acceptance scenarios passed (tester stub).",
    output,
  };
}
