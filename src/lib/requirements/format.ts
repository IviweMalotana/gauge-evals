import crypto from "crypto";

/**
 * Requirement file format — Cucumber/Gherkin.
 *
 * The living requirements corpus documents the entire codebase's behaviour as
 * version-controlled Gherkin `.feature` files (Feature / Scenario /
 * Given-When-Then) in the target repo:
 *   requirements/<category>/REQ-xxxxxxxx.feature
 *
 * Metadata rides on Gherkin tags above the Feature (the idiomatic place for it),
 * so the files stay valid Gherkin that a Cucumber runner could execute:
 *   @id:REQ-ab12cd34 @backend @status:accepted @v3 @code:src/lib/auth.ts @related:REQ-ff00
 *   Feature: User sign-in
 *     ...
 *     Scenario: ...
 *       Given ... / When ... / Then ...
 */

export const REQUIREMENT_CATEGORIES = ["ux", "design", "backend", "data", "api"] as const;
export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];

export const REQUIREMENT_STATUSES = ["draft", "accepted", "superseded"] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

export interface RequirementFeature {
  id: string; // REQ-xxxxxxxx
  title: string; // the Feature name
  category: RequirementCategory;
  status: RequirementStatus;
  version: number;
  related: string[]; // related requirement ids
  codeAreas: string[]; // file paths this behaviour is implemented by
  updatedBySource?: string; // request id that last changed it
  body: string; // everything under `Feature:` — narrative + Scenario blocks (Gherkin)
}

export function newRequirementId(): string {
  return `REQ-${crypto.randomBytes(4).toString("hex")}`;
}

export function requirementPath(category: RequirementCategory, id: string): string {
  return `requirements/${category}/${id}.feature`;
}

/** Serialize a requirement to its `.feature` file contents. */
export function serializeRequirement(r: RequirementFeature): string {
  const tags = [
    `@id:${r.id}`,
    `@${r.category}`,
    `@status:${r.status}`,
    `@v${r.version}`,
    ...r.codeAreas.map((c) => `@code:${tagSafe(c)}`),
    ...r.related.map((rel) => `@related:${rel}`),
  ];
  if (r.updatedBySource) tags.push(`@src:${r.updatedBySource}`);

  const body = r.body.trim();
  return `${tags.join(" ")}\nFeature: ${inline(r.title)}\n\n${body}\n`;
}

/** Parse a `.feature` requirement file. Throws if it has no `Feature:` line. */
export function parseRequirement(text: string): RequirementFeature {
  const norm = text.replace(/\r\n/g, "\n");
  const lines = norm.split("\n");
  const featureIdx = lines.findIndex((l) => /^\s*Feature:/.test(l));
  if (featureIdx === -1) throw new Error("Not a Gherkin feature (no `Feature:` line)");

  // Tags live on the lines above `Feature:` (may span several lines).
  const tagTokens = lines
    .slice(0, featureIdx)
    .join(" ")
    .split(/\s+/)
    .filter((t) => t.startsWith("@"));

  const title = lines[featureIdx].replace(/^\s*Feature:\s*/, "").trim();
  const body = lines.slice(featureIdx + 1).join("\n").trim();

  const tagVal = (prefix: string) => {
    const t = tagTokens.find((x) => x.startsWith(prefix));
    return t ? t.slice(prefix.length) : undefined;
  };
  const tagAll = (prefix: string) =>
    tagTokens.filter((x) => x.startsWith(prefix)).map((x) => x.slice(prefix.length));

  const category = (tagTokens
    .map((t) => t.slice(1))
    .find((t) => (REQUIREMENT_CATEGORIES as readonly string[]).includes(t)) ??
    "backend") as RequirementCategory;

  const status = (tagVal("@status:") ?? "accepted") as RequirementStatus;
  const versionTag = tagTokens.find((t) => /^@v\d+$/.test(t));

  return {
    id: tagVal("@id:") ?? newRequirementId(),
    title: title || "(untitled)",
    category,
    status: (REQUIREMENT_STATUSES as readonly string[]).includes(status) ? status : "accepted",
    version: versionTag ? Number.parseInt(versionTag.slice(2), 10) || 1 : 1,
    related: tagAll("@related:"),
    codeAreas: tagAll("@code:"),
    updatedBySource: tagVal("@src:") || undefined,
    body,
  };
}

// Tags can't contain whitespace; collapse it in code paths (paths rarely have any).
function tagSafe(s: string): string {
  return s.trim().replace(/\s+/g, "_");
}

function inline(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}
