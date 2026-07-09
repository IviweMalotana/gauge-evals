/**
 * Unit test for the requirements seed agent's PURE assembly — the parts that
 * turn a model's structured output into valid Gherkin `.feature` files, with no
 * network. It verifies:
 *   1. sanitizeSpecs drops malformed specs and invented code paths,
 *   2. buildRequirementBody emits valid Scenario / Given-When-Then blocks,
 *   3. specToRequirement + serializeRequirement round-trips through the parser
 *      back to the same category/title/scenarios (so the corpus stays valid).
 *
 * Run: npx tsx scripts/test-requirements-seed.ts
 */

import {
  buildRequirementBody,
  extractSpecObjects,
  sanitizeSpecs,
  specToRequirement,
  type SeedRequirementSpec,
} from "../src/lib/requirements/seed";
import { parseRequirement, serializeRequirement } from "../src/lib/requirements/format";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const realPaths = new Set([
  "src/app/(auth)/login/page.tsx",
  "src/lib/auth.ts",
  "prisma/schema.prisma",
]);

// A model response mixing good specs with junk that must be filtered out.
const modelOutput = [
  {
    category: "ux",
    title: "User sign-in with email and password",
    narrative: "As a returning user I want to sign in so I can reach my dashboard.",
    codeAreas: ["src/app/(auth)/login/page.tsx", "does/not/exist.ts"], // 2nd is invented
    scenarios: [
      {
        name: "Successful sign-in",
        given: ["a registered user with valid credentials"],
        when: ["they submit the sign-in form"],
        then: ["a session is created", "they land on the dashboard"],
      },
    ],
  },
  {
    category: "data",
    title: "Company owns users and requests",
    codeAreas: ["prisma/schema.prisma"],
    scenarios: [{ name: "Cascade", given: [], when: [], then: ["deleting a company removes its requests"] }],
  },
  { category: "nonsense", title: "bad category", codeAreas: [], scenarios: [] }, // dropped: bad category
  { category: "backend", title: "", codeAreas: [], scenarios: [] }, // dropped: no title
  { category: "api", title: "no scenarios", codeAreas: [], scenarios: [] }, // dropped: no scenarios
];

function main() {
  console.log("requirements seed — pure assembly\n");

  console.log("extractSpecObjects");
  // Clean, well-formed response → all elements.
  const clean = JSON.stringify({ requirements: modelOutput });
  check("clean response yields all elements", extractSpecObjects(clean).length === modelOutput.length);
  // TRUNCATED response (the real bug): cut off mid-way through the 3rd object.
  const full = JSON.stringify({ requirements: modelOutput }, null, 2);
  const truncated = full.slice(0, full.indexOf('"bad category"') + 5); // hard cut, invalid JSON
  const salvaged = extractSpecObjects(truncated);
  check("truncated response still parses (does not throw)", Array.isArray(salvaged));
  check(
    "salvages the complete leading elements, drops the cut-off tail",
    salvaged.length === 2,
    `got ${salvaged.length}`
  );
  check("no JSON key found → empty array, no throw", extractSpecObjects("not json at all").length === 0);

  console.log("\nsanitizeSpecs");
  const specs = sanitizeSpecs(modelOutput, realPaths);
  check("keeps only the well-formed specs", specs.length === 2, `got ${specs.length}`);
  check(
    "drops invented code paths, keeps real ones",
    specs[0].codeAreas.length === 1 && specs[0].codeAreas[0] === "src/app/(auth)/login/page.tsx",
    JSON.stringify(specs[0].codeAreas)
  );

  console.log("\nbuildRequirementBody");
  const body = buildRequirementBody(specs[0]);
  check("contains a Scenario line", body.includes("  Scenario: Successful sign-in"));
  check("Given/When/Then present", /Given /.test(body) && /When /.test(body) && /Then /.test(body));
  check("multiple Thens use 'And'", body.includes("    And they land on the dashboard"));
  const stepless = buildRequirementBody({
    category: "ux",
    title: "T",
    codeAreas: [],
    scenarios: [{ name: "S", given: [], when: [], then: [] }],
  } as SeedRequirementSpec);
  check("a step-less scenario still gets a Then", /Then /.test(stepless));

  console.log("\nspecToRequirement + serialize/parse round-trip");
  const feature = specToRequirement(specs[0]);
  check("id looks like REQ-xxxxxxxx", /^REQ-[0-9a-f]{8}$/.test(feature.id), feature.id);
  check("status accepted, version 1", feature.status === "accepted" && feature.version === 1);

  const serialized = serializeRequirement(feature);
  check("serialized file starts with tags then Feature", /@id:REQ-[0-9a-f]{8}[\s\S]*\nFeature: /.test(serialized));
  check("tag line carries the real code path", serialized.includes("@code:src/app/(auth)/login/page.tsx"));

  const reparsed = parseRequirement(serialized);
  check("round-trips category", reparsed.category === "ux", reparsed.category);
  check("round-trips title", reparsed.title === feature.title, reparsed.title);
  check("round-trips code areas", JSON.stringify(reparsed.codeAreas) === JSON.stringify(feature.codeAreas));
  check("body survives round-trip", reparsed.body.includes("Scenario: Successful sign-in"));

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: seed produces valid, round-trippable Gherkin requirements.");
}

main();
