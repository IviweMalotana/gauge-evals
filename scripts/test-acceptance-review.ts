/**
 * Regression test for the code-review acceptance path.
 *
 * Background: the no-preview acceptance stage code-reviews the committed DIFF
 * (base...branch) against the BRD's acceptance criteria. A live run once
 * false-negatived a *correct* change — the reviewer claimed "no changes were
 * made" even though the branch really did change the login heading to
 * "Sign in to Baton". PR #19 moved the reviewer from whole-file inference to
 * judging GitHub's authoritative unified diff.
 *
 * This test locks that in: it feeds `codeAcceptanceReview` a known-correct
 * single-line diff and asserts a PASS verdict. It runs fully offline by
 * injecting the diff-fetcher and the model completion (no GitHub, no Anthropic),
 * and it verifies two things:
 *   1. the "+" line of the real diff reaches the reviewer prompt intact, and
 *   2. a PASS sub-verdict flows through to `passed: true`.
 *
 * Run: npx tsx scripts/test-acceptance-review.ts
 */

import {
  buildReviewPrompt,
  codeAcceptanceReview,
  interpretReviewResult,
  type AcceptanceReviewDeps,
} from "../src/lib/agents/tester";
import type { DiffFile } from "../src/lib/github";
import type { AgentContext, BrdResult, BuildResult } from "../src/lib/agents/types";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// --- The known-correct diff (the exact change from the live run) ---
const CORRECT_DIFF: DiffFile[] = [
  {
    filename: "src/app/(auth)/login/page.tsx",
    status: "modified",
    additions: 1,
    deletions: 1,
    patch: [
      "@@ -18,7 +18,7 @@ export default function LoginPage() {",
      "       <div style={{ textAlign: \"center\" }}>",
      "-      <h1 style={{ fontSize: 28 }}>Sign in</h1>",
      "+      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>",
      "       <p>Welcome back.</p>",
    ].join("\n"),
  },
];

const BRD: BrdResult = {
  narrative: "The login page heading should welcome users to Baton by name.",
  gherkin: "",
  acceptanceCriteria: ['The login page heading reads "Sign in to Baton".'],
  model: "test",
};

const BUILD: BuildResult = {
  branch: "baton/cmrcghdg",
  summary: "Update login heading.",
  diff: "",
  committed: true,
  filesChanged: ["src/app/(auth)/login/page.tsx"],
};

function fakeCtx(): AgentContext {
  return {
    request: { id: "cmrcghdgc0001t5lc3kuiczbf", title: "Update login heading" } as AgentContext["request"],
    repo: "owner/repo",
    githubToken: "test-token",
    log: async () => {},
  };
}

async function main() {
  console.log("codeAcceptanceReview — known-correct diff → PASS\n");

  // 1. The pure prompt builder carries the real "+" line to the reviewer.
  console.log("buildReviewPrompt");
  const prompt = buildReviewPrompt(BRD.acceptanceCriteria, CORRECT_DIFF);
  check(
    "prompt contains the added '+' line verbatim",
    prompt.includes('+      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>'),
    "the diff line the reviewer must judge was not in the prompt"
  );
  check("prompt contains the acceptance criterion", prompt.includes("Sign in to Baton"));
  check(
    "prompt is not the empty-diff sentinel",
    !prompt.includes("(no file differences found between base and branch)")
  );

  // 2. A reviewer that reads the diff literally returns PASS, and that flows
  //    through to passed:true. The stub asserts the prompt actually contains
  //    the change before answering — so this only passes if wiring is intact.
  console.log("\ncodeAcceptanceReview (stubbed diff + reviewer)");
  const deps: AcceptanceReviewDeps = {
    getBase: async () => "main",
    getDiff: async () => CORRECT_DIFF,
    getFileContents: async () => null,
    complete: async ({ user }) => {
      const sawChange = user.includes("+      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>");
      return {
        summary: sawChange ? "The heading was changed as required." : "No change found.",
        passed: sawChange,
        results: [
          {
            criterion: BRD.acceptanceCriteria[0],
            passed: sawChange,
            note: sawChange
              ? '+      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>'
              : "no matching + line",
          },
        ],
      };
    },
  };

  const result = await codeAcceptanceReview(fakeCtx(), BUILD, BRD, deps);
  check("result.passed is true for the correct diff", result.passed === true, JSON.stringify(result));
  check("result.kind is 'acceptance'", result.kind === "acceptance");
  check("output records a PASS line", result.output.some((l) => l.startsWith("PASS")));

  // 3. Guard against the original bug's shape: a PASS verdict must not fail.
  console.log("\ninterpretReviewResult (verdict semantics)");
  const passInterpret = interpretReviewResult({
    summary: "ok",
    results: [{ criterion: "x", verdict: "pass", note: "+ line" }],
  });
  check("a 'pass' verdict yields passed:true", passInterpret.passed === true);

  // 4. It still fails honestly when the diff genuinely contradicts a criterion.
  const failInterpret = interpretReviewResult({
    results: [{ criterion: "x", verdict: "fail", note: "contradicted" }],
  });
  check("a 'fail' verdict yields passed:false", failInterpret.passed === false);

  // 5. The reported bug: some sub-criteria are only checkable at runtime/visually
  //    (typography consistency, non-interference). "unverifiable" must NOT block.
  const mixed = interpretReviewResult({
    results: [
      { criterion: "text present as subtitle", verdict: "pass", note: "+ line" },
      { criterion: "visible on load", verdict: "pass", note: "+ line" },
      { criterion: "doesn't change by session", verdict: "pass", note: "static" },
      { criterion: "typography consistent with other headings", verdict: "unverifiable", note: "needs render" },
      { criterion: "doesn't interfere with siblings", verdict: "unverifiable", note: "needs render" },
    ],
  });
  check("3 pass + 2 unverifiable → passed:true (not blocked)", mixed.passed === true, JSON.stringify(mixed));
  check("unverifiable criteria render as N/A, not FAIL", mixed.output.filter((l) => l.startsWith("N/A")).length === 2 && !mixed.output.some((l) => l.startsWith("FAIL")));
  check("summary flags the unverifiable count", /not verifiable from the diff/.test(mixed.summary), mixed.summary);

  // 6. A run that is ONLY unverifiable still doesn't hard-fail (non-blocking).
  const allUnver = interpretReviewResult({
    results: [{ criterion: "looks nice", verdict: "unverifiable", note: "visual" }],
  });
  check("all-unverifiable → passed:true (no contradiction)", allUnver.passed === true);

  // 7. Back-compat: an older boolean `passed:false` still fails.
  const legacyFail = interpretReviewResult({ results: [{ criterion: "x", passed: false, note: "absent" }] });
  check("legacy boolean passed:false still fails", legacyFail.passed === false);

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: acceptance code-review returns PASS on a known-correct diff.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
