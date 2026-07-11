/**
 * Unit test for the UI fixer's PURE logic — selecting which files/rules to
 * check and normalizing the model's violation report, with no network. Verifies:
 *   1. changedUiFiles keeps only UI extensions,
 *   2. extractRuleLines pulls Then/And steps out of a design requirement body,
 *   3. parseConformanceReport drops empty details and violations pointing at
 *      files that weren't changed,
 *   4. formatConformanceWarnings renders readable lines.
 *
 * Run: npx tsx scripts/test-ui-fixer.ts
 */

import {
  changedUiFiles,
  extractRuleLines,
  formatConformanceWarnings,
  parseConformanceReport,
} from "../src/lib/agents/uiFixer";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function main() {
  console.log("UI fixer — pure logic\n");

  console.log("changedUiFiles");
  const ui = changedUiFiles([
    "src/app/(auth)/login/page.tsx",
    "src/app/globals.css",
    "src/lib/auth.ts",
    "prisma/schema.prisma",
    "README.md",
  ]);
  check("keeps .tsx and .css", ui.includes("src/app/(auth)/login/page.tsx") && ui.includes("src/app/globals.css"));
  check("drops non-UI files", !ui.includes("src/lib/auth.ts") && !ui.includes("prisma/schema.prisma"));

  console.log("\nextractRuleLines");
  const body = `  A bordered content container. Canonical class: \`card\`.

  Scenario: Structure
    Given a Card component
    Then it has a heading
    And it has a body

  Scenario: Conformance rules
    Given a Card component
    Then a card always uses the .card class
    And cards do not nest inside cards`;
  const rules = extractRuleLines(body);
  check("pulls Then + And rule lines", rules.includes("a card always uses the .card class") && rules.includes("it has a heading"));
  check("ignores Given/narrative", !rules.some((r) => /Given|bordered content/.test(r)), JSON.stringify(rules));

  console.log("\nparseConformanceReport");
  const changed = ["src/app/(auth)/login/page.tsx"];
  const raw = [
    { file: "src/app/(auth)/login/page.tsx", rule: "card uses .card", detail: "container has no card class", fix: "add className=\"card\"" },
    { file: "src/components/Other.tsx", rule: "x", detail: "not part of this change" }, // dropped: unchanged file
    { file: "src/app/(auth)/login/page.tsx", rule: "y", detail: "" }, // dropped: empty detail
  ];
  const violations = parseConformanceReport(raw, changed);
  check("keeps only changed-file violations with detail", violations.length === 1, `${violations.length}`);
  check("normalizes fields", violations[0].file === changed[0] && violations[0].detail.length > 0);

  console.log("\nformatConformanceWarnings");
  const lines = formatConformanceWarnings(violations);
  check("renders file + detail + rule + fix", /login\/page\.tsx: container has no card class \(rule: card uses \.card\) → add/.test(lines[0]), lines[0]);
  check("empty violations → no lines", formatConformanceWarnings([]).length === 0);

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: UI fixer selects UI files/rules and normalizes violations correctly.");
}

main();
