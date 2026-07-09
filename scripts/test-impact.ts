/**
 * Unit test for the impact-analysis agent's PURE logic — the parts that turn a
 * model's related/drafts response into resolved, committable requirement
 * changes, with no network. It verifies:
 *   1. parseImpactResponse resolves `related` against real candidates and drops
 *      unknown reqIds,
 *   2. an "update" draft inherits the candidate's id / path / category, while a
 *      "new" draft gets a fresh REQ id + requirements/<category>/ path,
 *   3. malformed drafts (no title, no scenarios, update with unknown reqId) are
 *      dropped, and the salvage parser tolerates a truncated response,
 *   4. draftToFile emits valid, parseable Gherkin.
 *
 * Run: npx tsx scripts/test-impact.ts
 */

import {
  draftToFile,
  parseImpactResponse,
  impactQuery,
} from "../src/lib/agents/impact";
import { salvageArray } from "../src/lib/requirements/seed";
import { parseRequirement } from "../src/lib/requirements/format";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const candidates = [
  {
    reqId: "REQ-01423cff",
    title: "GitHub OAuth start",
    category: "api",
    filePath: "requirements/api/REQ-01423cff.feature",
    body: "  Scenario: Redirect\n    Given a user\n    When they connect\n    Then redirected",
    codeAreas: ["src/app/api/oauth/github/start/route.ts"],
  },
  {
    reqId: "REQ-52a472ba",
    title: "Sign-in page",
    category: "ux",
    filePath: "requirements/ux/REQ-52a472ba.feature",
    body: "  Scenario: Shows form\n    Then the form is visible",
    codeAreas: ["src/app/(auth)/login/page.tsx"],
  },
];

// The real repo tree — hallucinated paths must be dropped against this.
const realPaths = new Set<string>([
  "src/app/(auth)/login/page.tsx",
  "src/app/api/oauth/github/start/route.ts",
  "prisma/schema.prisma",
]);

function main() {
  console.log("impact analysis — pure logic\n");

  console.log("impactQuery");
  const q = impactQuery({ title: "Rename heading", description: "change login title" }, {
    narrative: "Update the login heading",
    gherkin: "",
    acceptanceCriteria: ["Heading reads 'Sign in to Baton'"],
    model: "test",
  });
  check("query weaves in title, description, narrative, criteria", /Rename heading/.test(q) && /Sign in to Baton/.test(q));

  console.log("\nparseImpactResponse");
  const related = [
    { reqId: "REQ-52a472ba", affected: true, reason: "heading text changes" },
    { reqId: "REQ-01423cff", affected: false, reason: "unrelated" },
    { reqId: "REQ-doesnotexist", affected: true, reason: "hallucinated" }, // dropped
  ];
  const drafts = [
    {
      op: "update",
      reqId: "REQ-52a472ba",
      title: "Sign-in page shows Baton branding",
      narrative: "As a user I see the Baton name on the sign-in page.",
      codeAreas: ["src/app/(auth)/login/page.tsx"],
      scenarios: [{ name: "Heading", given: [], when: ["I open /login"], then: ["I see 'Sign in to Baton'"] }],
    },
    {
      op: "new",
      category: "ux",
      title: "Brand name appears on auth pages",
      // one real path + one hallucinated path that must be dropped
      codeAreas: ["src/app/(auth)/login/page.tsx", "app/views/auth/signin.html"],
      scenarios: [{ name: "Brand", given: [], when: [], then: ["the product name is shown"] }],
    },
    { op: "update", reqId: "REQ-unknown", title: "bad", scenarios: [{ name: "x", then: ["y"] }] }, // dropped: unknown id
    { op: "new", category: "ux", title: "", scenarios: [] }, // dropped: no title/scenarios
  ];

  const result = parseImpactResponse(related, drafts, candidates, "One requirement updated, one added.", realPaths);
  check("summary passed through", result.summary === "One requirement updated, one added.");
  check("related resolves known ids only (2 of 3)", result.related.length === 2, `${result.related.length}`);
  check(
    "affected flag + resolved title/path from candidate",
    result.related[0].affected === true &&
      result.related[0].title === "Sign-in page" &&
      result.related[0].filePath === "requirements/ux/REQ-52a472ba.feature"
  );
  check("keeps the two valid drafts, drops the two bad ones", result.drafts.length === 2, `${result.drafts.length}`);

  const upd = result.drafts.find((d) => d.op === "update")!;
  check("update inherits candidate id/path/category", upd.reqId === "REQ-52a472ba" && upd.filePath === "requirements/ux/REQ-52a472ba.feature" && upd.category === "ux");
  const created = result.drafts.find((d) => d.op === "new")!;
  check("new gets fresh REQ id", /^REQ-[0-9a-f]{8}$/.test(created.reqId), created.reqId);
  check("new path is requirements/<category>/<id>.feature", created.filePath === `requirements/ux/${created.reqId}.feature`);
  check(
    "hallucinated @code path is dropped, real one kept",
    created.codeAreas.length === 1 && created.codeAreas[0] === "src/app/(auth)/login/page.tsx",
    JSON.stringify(created.codeAreas)
  );
  check(
    "update unions the candidate's existing real @code paths",
    upd.codeAreas.includes("src/app/(auth)/login/page.tsx")
  );

  console.log("\ndraftToFile → valid Gherkin");
  const file = draftToFile(upd);
  check("path matches the draft", file.path === upd.filePath);
  const parsed = parseRequirement(file.contents);
  check("serialized draft re-parses", parsed.title === upd.title && parsed.category === "ux");
  check("carries the @code tag", file.contents.includes("@code:src/app/(auth)/login/page.tsx"));
  check("body has Given/When/Then", /When /.test(parsed.body) && /Then /.test(parsed.body));

  console.log("\nsalvageArray on a truncated impact response");
  const whole = JSON.stringify({ summary: "s", related, drafts });
  const cut = whole.slice(0, whole.indexOf('"REQ-doesnotexist"')); // truncate mid related array
  const salvagedRelated = salvageArray(cut, "related");
  check("truncated related still yields complete elements", salvagedRelated.length >= 2, `${salvagedRelated.length}`);
  check("no throw on truncation", Array.isArray(salvagedRelated));

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: impact analysis resolves drafts into valid, committable requirement changes.");
}

main();
