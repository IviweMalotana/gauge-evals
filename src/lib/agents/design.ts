import { completeText, getAnthropic } from "../anthropic";
import { features } from "../env";
import { APP_NAME, BRANCH_PREFIX } from "../brand";
import {
  commitFiles,
  createPr,
  getDefaultBranch,
  getFile,
  getTree,
  type GhClient,
} from "../github";
import {
  inline,
  newRequirementId,
  requirementPath,
  serializeRequirement,
  type RequirementFeature,
} from "../requirements/format";
import { buildRequirementBody, salvageArray, type SeedScenario } from "../requirements/seed";
import { syncRequirementIndex } from "../requirements/store";

/**
 * Design-system extraction agent (Phase 4 of the living-requirements system).
 *
 * Reads the repo's UI (global styles, components, page markup) and learns the
 * codebase's component library — cards, tables, dialogs, buttons, badges, etc. —
 * as STRICT definitions: each component's anatomy, variants, and conformance
 * rules, grounded in the real classes/markup. It writes two artifacts in one PR:
 *   - design/components.md         — a human-readable catalog, and
 *   - requirements/design/REQ-*.feature — one design-category requirement per
 *     component (filling the corpus's design coverage and giving the UI fixer
 *     something to check changed UI against).
 *
 * Grounded like the seed/impact agents: component codeAreas are filtered to real
 * repo paths; scenarios are assembled deterministically so the .feature files
 * are always valid Gherkin.
 */

const DESIGN_SYSTEM = `You are a design-systems engineer documenting an EXISTING codebase's component
library from its real UI code (global CSS, components, page markup).

Identify the reusable UI components actually present (e.g. card, table, dialog/
modal, button, badge, form field, notice/banner, navigation). For each, define
it STRICTLY from the code:
- description: what it is and when it's used,
- className: the canonical CSS class or selector it uses (from the real CSS),
- anatomy: its structural parts (e.g. "a header", "a body", "an actions row"),
- variants: named variants that exist (e.g. "secondary", "danger", "small"),
- rules: precise conformance rules a reviewer could enforce (e.g. "a card always
  uses the .card class", "danger actions use the .btn.danger variant"),
- codeAreas: the REAL files that define/implement it (choose only from the file
  list provided).

Document only components the code actually contains. Prefer precise, checkable
rules over generic advice.

Reply with a SINGLE JSON object only, matching exactly:
{
  "components": [
    {
      "name": string,
      "description": string,
      "className": string,
      "anatomy": string[],
      "variants": string[],
      "rules": string[],
      "codeAreas": string[]
    }
  ]
}`;

export interface ComponentSpec {
  name: string;
  description: string;
  className: string;
  anatomy: string[];
  variants: string[];
  rules: string[];
  codeAreas: string[];
}

export interface DesignResult {
  count: number;
  prNumber: number | null;
  prUrl: string | null;
  branch: string;
  components: string[];
}

const MAX_TREE_PATHS = 300;
const MAX_SAMPLE_FILES = 12;
const MAX_FILE_CHARS = 3000;
const MAX_COMPONENTS = 24;
const DESIGN_MAX_TOKENS = 8000;

// UI-bearing files: styles, components, and page/layout markup.
const UI_FILE = /\.(css|scss)$/i;
const UI_CODE = /(components?|ui|design)\//i;
const PAGE_CODE = /\.(tsx|jsx|vue|svelte)$/i;
const EXCLUDED = /^(node_modules|\.next|dist|build|coverage|public\/artifacts|requirements)\//;

/** Keep only well-formed component specs; drop code paths not in the real tree. */
export function sanitizeComponents(raw: unknown, realPaths?: Set<string>): ComponentSpec[] {
  const list = Array.isArray(raw) ? raw : [];
  const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean) : []);
  const out: ComponentSpec[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = item as Partial<ComponentSpec>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    const rules = strArr(o.rules);
    const anatomy = strArr(o.anatomy);
    if (rules.length === 0 && anatomy.length === 0) continue; // nothing checkable
    seen.add(key);
    const codeAreas = strArr(o.codeAreas).filter((p) => !realPaths || realPaths.has(p));
    out.push({
      name,
      description: typeof o.description === "string" ? o.description.trim() : "",
      className: typeof o.className === "string" ? o.className.trim() : "",
      anatomy,
      variants: strArr(o.variants),
      rules,
      codeAreas,
    });
  }
  return out.slice(0, MAX_COMPONENTS);
}

/** Build the Gherkin scenarios describing a component's definition. Pure. */
export function componentToScenarios(c: ComponentSpec): SeedScenario[] {
  const given = [`a ${c.name} component`];
  const scenarios: SeedScenario[] = [];
  if (c.anatomy.length > 0) {
    scenarios.push({ name: "Structure", given, when: [], then: c.anatomy.map((a) => `it has ${a}`) });
  }
  if (c.rules.length > 0) {
    scenarios.push({ name: "Conformance rules", given, when: [], then: c.rules });
  }
  if (c.variants.length > 0) {
    scenarios.push({
      name: "Variants",
      given,
      when: [],
      then: [`the supported variants are ${c.variants.join(", ")}`],
    });
  }
  if (scenarios.length === 0) {
    scenarios.push({ name: "Definition", given, when: [], then: [`it follows the ${c.name} definition`] });
  }
  return scenarios;
}

/** Turn a component spec into a design-category RequirementFeature. Pure. */
export function componentToFeature(c: ComponentSpec): RequirementFeature {
  const narrativeParts = [c.description, c.className ? `Canonical class: \`${c.className}\`.` : ""].filter(Boolean);
  return {
    id: newRequirementId(),
    title: `${c.name} component`,
    category: "design",
    status: "accepted",
    version: 1,
    related: [],
    codeAreas: c.codeAreas,
    body: buildRequirementBody({
      category: "design",
      title: `${c.name} component`,
      narrative: narrativeParts.join(" "),
      codeAreas: c.codeAreas,
      scenarios: componentToScenarios(c),
    }),
  };
}

/** Render the human-readable component catalog. Pure. */
export function renderCatalogMarkdown(components: ComponentSpec[]): string {
  const sections = components.map((c) => {
    const lines = [`## ${c.name}`, "", c.description || "_No description._", ""];
    if (c.className) lines.push(`- **Class:** \`${c.className}\``);
    if (c.variants.length) lines.push(`- **Variants:** ${c.variants.map((v) => `\`${v}\``).join(", ")}`);
    if (c.codeAreas.length) lines.push(`- **Defined in:** ${c.codeAreas.map((p) => `\`${p}\``).join(", ")}`);
    if (c.anatomy.length) {
      lines.push("", "**Anatomy**", ...c.anatomy.map((a) => `- ${a}`));
    }
    if (c.rules.length) {
      lines.push("", "**Rules**", ...c.rules.map((r) => `- ${r}`));
    }
    return lines.join("\n");
  });

  return `# Component library

The strict definitions of this codebase's UI components, extracted by **${APP_NAME}**
from the current code. Each component is also a design-category requirement in
\`requirements/design/\`; ${APP_NAME}'s UI fixer checks changed UI against these
rules.

${sections.join("\n\n")}

_Total: ${components.length} component(s)._
`;
}

/** Prioritize style + component + page files so the capped sample is UI-relevant. */
function prioritize(paths: string[]): string[] {
  const score = (p: string) => {
    if (UI_FILE.test(p)) return 0; // CSS first — that's where the design tokens live
    if (UI_CODE.test(p)) return 1;
    if (p.startsWith("src/app/") && PAGE_CODE.test(p)) return 2;
    return 3;
  };
  return [...paths].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** Run design extraction end-to-end for a company. Throws on missing prereqs. */
export async function extractDesignSystem(args: {
  companyId: string;
  repo: string;
  token: string;
  log?: (msg: string) => void;
}): Promise<DesignResult> {
  const log = args.log ?? ((m: string) => console.log(`[design] ${m}`));
  if (!features.anthropic || !getAnthropic()) throw new Error("Design extraction requires ANTHROPIC_API_KEY");

  const client: GhClient = { token: args.token, repo: args.repo };
  const { base, baseSha } = await getDefaultBranch(client);
  log(`Reading ${args.repo}@${base} for UI code…`);

  const { entries, truncated } = await getTree(client, base);
  const uiFiles = entries
    .filter(
      (e) =>
        e.type === "blob" &&
        !EXCLUDED.test(e.path) &&
        (UI_FILE.test(e.path) || UI_CODE.test(e.path) || (e.path.startsWith("src/app/") && PAGE_CODE.test(e.path)))
    )
    .map((e) => e.path);
  const realPaths = new Set(entries.filter((e) => e.type === "blob").map((e) => e.path));
  const treeList = prioritize(uiFiles).slice(0, MAX_TREE_PATHS);
  log(`Found ${uiFiles.length} UI file(s)${truncated ? " (tree truncated)" : ""}.`);

  const sample: { path: string; contents: string }[] = [];
  for (const path of treeList.slice(0, MAX_SAMPLE_FILES)) {
    const file = await getFile(client, path, base);
    if (file) sample.push({ path, contents: file.contents.slice(0, MAX_FILE_CHARS) });
  }
  log(`Sampled ${sample.length} UI file(s) for context.`);

  const text = await completeText({
    system: DESIGN_SYSTEM,
    user: `Repository: ${args.repo}

UI file list (real paths — cite only these in codeAreas):
${treeList.join("\n")}

Sample UI file contents:
${sample.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Document the component library as JSON.`,
    maxTokens: DESIGN_MAX_TOKENS,
  });

  const components = sanitizeComponents(salvageArray(text, "components"), realPaths);
  if (components.length === 0) throw new Error("Model produced no usable components");

  const featuresOut = components.map(componentToFeature);
  const files = featuresOut.map((f) => ({
    path: requirementPath("design", f.id),
    contents: serializeRequirement(f),
  }));
  files.push({ path: "design/components.md", contents: renderCatalogMarkdown(components) });
  log(`Extracted ${components.length} component(s): ${components.map((c) => c.name).join(", ")}`);

  const branch = `${BRANCH_PREFIX}/design-system`;
  await commitFiles(client, {
    branch,
    baseSha,
    message: `${APP_NAME}: extract design system (${components.length} components)`,
    files,
  });
  log(`Committed ${files.length} file(s) to ${branch}.`);

  let prNumber: number | null = null;
  let prUrl: string | null = null;
  try {
    const pr = await createPr(client, {
      title: `[${APP_NAME}] Design system: component library`,
      head: branch,
      base,
      body: designPrBody(components),
    });
    prNumber = pr.number;
    prUrl = pr.url;
    log(`Opened PR #${pr.number}.`);
  } catch (err) {
    log(`Could not open PR (${(err as Error).message}); branch ${branch} is pushed.`);
  }

  try {
    await syncRequirementIndex({ companyId: args.companyId, repo: args.repo, client, ref: branch });
    log("Synced the design requirements into the index.");
  } catch (err) {
    log(`Index sync skipped (${(err as Error).message}).`);
  }

  return { count: components.length, prNumber, prUrl, branch, components: components.map((c) => c.name) };
}

function designPrBody(components: ComponentSpec[]): string {
  const list = components.map((c) => `- **${c.name}**${c.className ? ` (\`${c.className}\`)` : ""}`).join("\n");
  return `Extracted by **${APP_NAME}** — the strict definitions of this codebase's UI component library, learned from the current code.

${components.length} component(s):
${list}

Adds a human-readable \`design/components.md\` catalog and one \`requirements/design/REQ-*.feature\` per component (Feature / Scenario / Given-When-Then with \`@code:\` real paths). These become the design-category source of truth, and ${APP_NAME}'s UI fixer checks changed UI against these rules.

> Review the definitions before merging — tighten any rule that should be stricter.`;
}

// Keep inline referenced (used by buildRequirementBody indirectly); re-export for tests.
export { inline };
