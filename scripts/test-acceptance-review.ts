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

  // 3. Guard against the original bug's shape: if a reviewer ever returns a
  //    PASS sub-verdict, interpretReviewResult must not report failure.
  console.log("\ninterpretReviewResult (no self-contradiction)");
  const passInterpret = interpretReviewResult({
    summary: "ok",
    passed: true,
    results: [{ criterion: "x", passed: true, note: "+ line" }],
  });
  check("a PASS sub-verdict yields passed:true", passInterpret.passed === true);

  // 4. And it still fails honestly when the reviewer genuinely rejects.
  const failInterpret = interpretReviewResult({
    passed: false,
    results: [{ criterion: "x", passed: false, note: "absent" }],
  });
  check("a FAIL sub-verdict yields passed:false", failInterpret.passed === false);

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
