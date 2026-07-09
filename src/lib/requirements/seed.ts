import { completeJson, getAnthropic } from "../anthropic";
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
  REQUIREMENT_CATEGORIES,
  type RequirementCategory,
  type RequirementFeature,
} from "./format";
import { syncRequirementIndex } from "./store";

/**
 * Requirements seed agent (Phase 2 of the living-requirements system).
 *
 * On demand, it reads the connected repo's real source tree + a sample of file
 * contents and asks Claude to describe the codebase's *current behaviour* as a
 * baseline set of Gherkin `.feature` requirements spanning the five categories
 * (ux / design / backend / data / api). The scenarios are returned as STRUCTURED
 * steps and we assemble the Gherkin deterministically, so every file is valid
 * Feature / Scenario / Given-When-Then. All of it lands as a single PR — the
 * corpus becomes the version-controlled source of truth once merged.
 *
 * Grounding mirrors the builder: the model may only cite real repo paths in
 * `@code:` tags; invented paths are dropped.
 */

const SEED_SYSTEM = `You are a business analyst + QA lead documenting an EXISTING codebase's current
behaviour as a baseline requirements corpus, written as Cucumber/Gherkin.

You are given the repository's real file list and the contents of a sample of
files. Describe what the system ACTUALLY does today (not aspirations), grouped
into requirements. Cover these categories where the code supports them:
- ux       — user-facing flows and screens (pages, forms, navigation)
- design   — UI components and their rules (cards, tables, dialogs, layout)
- backend  — server logic, actions, auth, orchestration, jobs
- data     — the data model / persistence (schema, entities, relationships)
- api      — HTTP endpoints / routes and their contracts

Rules:
- Write in BA/QA voice — business behaviour, not implementation detail.
- Every requirement must reference the REAL files that implement it, using ONLY
  paths that appear in the provided file list.
- Each requirement has 1-3 concrete scenarios. Steps are plain business language.
- Prefer fewer, meaningful requirements over many trivial ones (aim 8-16 total).

Reply with a SINGLE JSON object only, matching exactly:
{
  "requirements": [
    {
      "category": "ux" | "design" | "backend" | "data" | "api",
      "title": string,                 // the Feature name
      "narrative": string,             // 1-2 sentence "In order to / As a / I want" style summary
      "codeAreas": string[],           // real repo paths this behaviour lives in
      "scenarios": [
        { "name": string, "given": string[], "when": string[], "then": string[] }
      ]
    }
  ]
}`;

export interface SeedScenario {
  name: string;
  given: string[];
  when: string[];
  then: string[];
}

export interface SeedRequirementSpec {
  category: RequirementCategory;
  title: string;
  narrative?: string;
  codeAreas: string[];
  scenarios: SeedScenario[];
}

export interface SeedResult {
  count: number;
  prNumber: number | null;
  prUrl: string | null;
  branch: string;
  categories: Record<string, number>;
}

const MAX_TREE_PATHS = 300;
const MAX_SAMPLE_FILES = 12;
const MAX_FILE_CHARS = 2500;
const MAX_REQUIREMENTS = 20;

const SOURCE_EXT = /\.(tsx?|jsx?|mjs|cjs|css|scss|html|json|prisma|md|py|rb|go|rs|java|vue|svelte)$/i;
const EXCLUDED = /^(node_modules|\.next|dist|build|coverage|public\/artifacts|requirements)\/|package-lock\.json$/;

/** Build the indented Gherkin body (narrative + scenarios) under `Feature:`. Pure. */
export function buildRequirementBody(spec: SeedRequirementSpec): string {
  const lines: string[] = [];
  const narrative = (spec.narrative ?? "").trim();
  if (narrative) {
    for (const l of narrative.split("\n")) lines.push(`  ${inline(l)}`);
    lines.push("");
  }

  const scenarios = spec.scenarios?.length
    ? spec.scenarios
    : [{ name: spec.title, given: [], when: [], then: [] }];

  scenarios.forEach((s, i) => {
    if (i > 0) lines.push("");
    lines.push(`  Scenario: ${inline(s.name || spec.title)}`);
    const groups: [string, string[]][] = [
      ["Given", s.given ?? []],
      ["When", s.when ?? []],
      ["Then", s.then ?? []],
    ];
    for (const [keyword, steps] of groups) {
      steps.filter(Boolean).forEach((step, j) => {
        lines.push(`    ${j === 0 ? keyword : "And"} ${inline(step)}`);
      });
    }
    // A scenario with no steps at all isn't useful Gherkin — give it a stub Then.
    if ((s.given?.length ?? 0) + (s.when?.length ?? 0) + (s.then?.length ?? 0) === 0) {
      lines.push(`    Then the behaviour described by "${inline(spec.title)}" holds`);
    }
  });

  return lines.join("\n");
}

/** Turn a validated spec into a RequirementFeature (assigns a fresh id). Pure. */
export function specToRequirement(spec: SeedRequirementSpec): RequirementFeature {
  return {
    id: newRequirementId(),
    title: spec.title.trim() || "(untitled)",
    category: spec.category,
    status: "accepted",
    version: 1,
    related: [],
    codeAreas: spec.codeAreas ?? [],
    body: buildRequirementBody(spec),
  };
}

/** Keep only well-formed specs, dropping code paths that aren't in the real tree. */
export function sanitizeSpecs(
  raw: unknown,
  realPaths: Set<string>
): SeedRequirementSpec[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: SeedRequirementSpec[] = [];
  for (const item of list) {
    const o = item as Partial<SeedRequirementSpec>;
    const category = o.category as RequirementCategory;
    if (!(REQUIREMENT_CATEGORIES as readonly string[]).includes(category)) continue;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const codeAreas = Array.isArray(o.codeAreas)
      ? o.codeAreas.map(String).filter((p) => realPaths.has(p))
      : [];
    const scenarios = Array.isArray(o.scenarios)
      ? o.scenarios
          .map((s) => {
            const sc = s as Partial<SeedScenario>;
            return {
              name: typeof sc.name === "string" ? sc.name : title,
              given: Array.isArray(sc.given) ? sc.given.map(String) : [],
              when: Array.isArray(sc.when) ? sc.when.map(String) : [],
              then: Array.isArray(sc.then) ? sc.then.map(String) : [],
            };
          })
          .filter((s) => s.name)
      : [];
    if (scenarios.length === 0) continue;
    out.push({ category, title, narrative: o.narrative, codeAreas, scenarios });
  }
  return out.slice(0, MAX_REQUIREMENTS);
}

/** A short README manifest committed alongside the corpus. */
function corpusReadme(features: RequirementFeature[]): string {
  const byCat = REQUIREMENT_CATEGORIES.map((cat) => {
    const items = features.filter((f) => f.category === cat);
    if (items.length === 0) return "";
    const rows = items
      .map((f) => `- \`${requirementPath(f.category, f.id)}\` — ${f.title}`)
      .join("\n");
    return `### ${cat}\n${rows}`;
  })
    .filter(Boolean)
    .join("\n\n");

  return `# Requirements corpus

The living, version-controlled requirements for this repository, written as
Cucumber/Gherkin \`.feature\` files (Feature / Scenario / Given-When-Then).
Seeded by **${APP_NAME}** from the current codebase; this is the source of
truth for behaviour. Each file's tags carry metadata (\`@id\`, category,
\`@status\`, \`@v\`, \`@code:\` paths, \`@related\`).

${byCat}

_Total: ${features.length} requirement(s)._
`;
}

/** Prioritize likely-app code so the capped tree keeps the important paths. */
function prioritize(paths: string[]): string[] {
  const score = (p: string) => {
    if (/^(prisma\/schema\.prisma)$/.test(p)) return 0;
    if (p.startsWith("src/app/")) return 1;
    if (p.startsWith("src/lib/")) return 2;
    if (p.startsWith("src/")) return 3;
    return 4;
  };
  return [...paths].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/**
 * Run the seed end-to-end for a company: read the repo, generate the corpus,
 * open a PR, and sync the index from the seed branch. `log` receives progress
 * lines (console by default). Throws on missing prerequisites.
 */
export async function seedRequirementsForCompany(args: {
  companyId: string;
  repo: string;
  token: string;
  log?: (msg: string) => void;
}): Promise<SeedResult> {
  const log = args.log ?? ((m: string) => console.log(`[seed] ${m}`));
  if (!features.anthropic || !getAnthropic()) {
    throw new Error("Seeding requires ANTHROPIC_API_KEY");
  }

  const client: GhClient = { token: args.token, repo: args.repo };
  const { base, baseSha } = await getDefaultBranch(client);
  log(`Reading ${args.repo}@${base}…`);

  const { entries, truncated } = await getTree(client, base);
  const sourceFiles = entries
    .filter((e) => e.type === "blob" && SOURCE_EXT.test(e.path) && !EXCLUDED.test(e.path))
    .map((e) => e.path);
  const realPaths = new Set(sourceFiles);
  const treeList = prioritize(sourceFiles).slice(0, MAX_TREE_PATHS);
  log(`Repo has ${sourceFiles.length} source file(s)${truncated ? " (tree truncated)" : ""}.`);

  // Sample a handful of the most important files for grounding.
  const sample: { path: string; contents: string }[] = [];
  for (const path of treeList.slice(0, MAX_SAMPLE_FILES)) {
    const file = await getFile(client, path, base);
    if (file) sample.push({ path, contents: file.contents.slice(0, MAX_FILE_CHARS) });
  }
  log(`Sampled ${sample.length} file(s) for context.`);

  const json = await completeJson({
    system: SEED_SYSTEM,
    user: `Repository: ${args.repo}

File list (real paths — cite only these in codeAreas):
${treeList.join("\n")}

Sample file contents:
${sample.map((f) => `\n=== ${f.path} ===\n${f.contents}`).join("\n")}

Describe the current behaviour as a baseline Gherkin requirements corpus. Return JSON.`,
    maxTokens: 4000,
  });

  const specs = sanitizeSpecs(json.requirements, realPaths);
  if (specs.length === 0) throw new Error("Model produced no usable requirements");

  const featuresOut = specs.map(specToRequirement);
  const corpusFiles = featuresOut.map((f) => ({
    path: requirementPath(f.category, f.id),
    contents: serializeRequirement(f),
  }));
  corpusFiles.push({ path: "requirements/README.md", contents: corpusReadme(featuresOut) });

  const categories: Record<string, number> = {};
  for (const f of featuresOut) categories[f.category] = (categories[f.category] ?? 0) + 1;
  log(
    `Generated ${featuresOut.length} requirement(s): ` +
      Object.entries(categories)
        .map(([c, n]) => `${c}:${n}`)
        .join(" ")
  );

  const branch = `${BRANCH_PREFIX}/seed-requirements`;
  await commitFiles(client, {
    branch,
    baseSha,
    message: `${APP_NAME}: seed requirements corpus (${featuresOut.length} features)`,
    files: corpusFiles,
  });
  log(`Committed ${corpusFiles.length} file(s) to ${branch}.`);

  let prNumber: number | null = null;
  let prUrl: string | null = null;
  try {
    const pr = await createPr(client, {
      title: `[${APP_NAME}] Seed requirements corpus`,
      head: branch,
      base,
      body: seedPrBody(featuresOut, categories),
    });
    prNumber = pr.number;
    prUrl = pr.url;
    log(`Opened PR #${pr.number}.`);
  } catch (err) {
    // A PR may already be open for this branch from a previous seed — not fatal.
    log(`Could not open PR (${(err as Error).message}); the branch ${branch} is pushed.`);
  }

  // Index the seeded corpus from the branch so search/impact analysis work
  // immediately (re-synced from the default branch once the PR merges).
  try {
    await syncRequirementIndex({
      companyId: args.companyId,
      repo: args.repo,
      client,
      ref: branch,
    });
    log("Synced the requirements index from the seed branch.");
  } catch (err) {
    log(`Index sync skipped (${(err as Error).message}).`);
  }

  return { count: featuresOut.length, prNumber, prUrl, branch, categories };
}

function seedPrBody(features: RequirementFeature[], categories: Record<string, number>): string {
  const breakdown = Object.entries(categories)
    .map(([c, n]) => `- **${c}**: ${n}`)
    .join("\n");
  return `Seeded by **${APP_NAME}** — a baseline **living requirements corpus** documenting this repository's current behaviour as Cucumber/Gherkin \`.feature\` files.

${features.length} requirement(s) across categories:
${breakdown}

Each file is valid Gherkin (Feature / Scenario / Given-When-Then) with metadata on tags (\`@id\`, category, \`@status:accepted\`, \`@v1\`, \`@code:\` real paths). Once merged, these become the version-controlled source of truth for behaviour, and ${APP_NAME} uses them for search and per-request impact analysis.

> Review and adjust before merging — refine any scenario that doesn't match intended behaviour.`;
}
