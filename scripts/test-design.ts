/**
 * Unit test for the design-extraction agent's PURE logic — turning a model's
 * component list into valid design-category Gherkin + a catalog, with no
 * network. Verifies:
 *   1. sanitizeComponents drops nameless/checkless dupes and invented codeAreas,
 *   2. componentToScenarios emits Structure/Rules/Variants Given-When-Then,
 *   3. componentToFeature → serialize → parse round-trips as a design requirement,
 *   4. renderCatalogMarkdown lists each component with its class + rules.
 *
 * Run: npx tsx scripts/test-design.ts
 */

import {
  componentToFeature,
  componentToScenarios,
  renderCatalogMarkdown,
  sanitizeComponents,
  type ComponentSpec,
} from "../src/lib/agents/design";
import { parseRequirement, serializeRequirement } from "../src/lib/requirements/format";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const realPaths = new Set(["src/app/globals.css", "src/app/(app)/settings/page.tsx"]);

const modelOutput = [
  {
    name: "Card",
    description: "A bordered content container.",
    className: "card",
    anatomy: ["a heading", "a body"],
    variants: [],
    rules: ["a card always uses the .card class", "cards do not nest inside cards"],
    codeAreas: ["src/app/globals.css", "does/not/exist.css"], // 2nd dropped
  },
  {
    name: "Button",
    description: "An action control.",
    className: "btn",
    anatomy: [],
    variants: ["secondary", "danger", "small"],
    rules: ["danger actions use .btn.danger"],
    codeAreas: ["src/app/globals.css"],
  },
  { name: "Card", description: "dupe", className: "card", anatomy: [], variants: [], rules: ["x"], codeAreas: [] }, // dropped: dup name
  { name: "", description: "no name", anatomy: [], variants: [], rules: ["x"], codeAreas: [] }, // dropped: no name
  { name: "Empty", description: "nothing checkable", anatomy: [], variants: [], rules: [], codeAreas: [] }, // dropped
];

function main() {
  console.log("design extraction — pure logic\n");

  console.log("sanitizeComponents");
  const comps = sanitizeComponents(modelOutput, realPaths);
  check("keeps the two well-formed, unique components", comps.length === 2, `${comps.length}`);
  check("drops invented codeAreas, keeps real ones", comps[0].codeAreas.length === 1 && comps[0].codeAreas[0] === "src/app/globals.css");

  console.log("\ncomponentToScenarios");
  const scen = componentToScenarios(comps[0]);
  check("has a Structure scenario from anatomy", scen.some((s) => s.name === "Structure" && s.then.some((t) => /heading/.test(t))));
  check("has a Conformance rules scenario", scen.some((s) => s.name === "Conformance rules" && s.then.length === 2));
  const btnScen = componentToScenarios(comps[1]);
  check("Button has a Variants scenario", btnScen.some((s) => s.name === "Variants" && s.then.some((t) => /secondary, danger, small/.test(t))));

  console.log("\ncomponentToFeature → serialize/parse round-trip");
  const feature = componentToFeature(comps[0]);
  check("category is design", feature.category === "design");
  check("title is '<Name> component'", feature.title === "Card component");
  const serialized = serializeRequirement(feature);
  check("tag line marks @design and real @code", /@design/.test(serialized) && serialized.includes("@code:src/app/globals.css"));
  const reparsed = parseRequirement(serialized);
  check("round-trips as design requirement", reparsed.category === "design" && reparsed.title === "Card component");
  check("body carries Given/Then", /Given a Card component/.test(reparsed.body) && /Then /.test(reparsed.body));

  console.log("\nrenderCatalogMarkdown");
  const md = renderCatalogMarkdown(comps);
  check("has a heading for each component", md.includes("## Card") && md.includes("## Button"));
  check("shows the class and a rule", md.includes("`card`") && md.includes("a card always uses the .card class"));
  check("counts the components", md.includes("Total: 2 component(s)"));

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: design extraction produces valid design requirements + catalog.");
}

main();
