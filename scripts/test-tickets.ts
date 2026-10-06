/**
 * Unit test for the delivery-ticket agent's PURE logic — buildTicketPlan,
 * which turns a BRD + plan into the product/design/backend/frontend/devops
 * ticket drafts Baton files in Jira. No network, no database.
 *
 * Verifies:
 *   1. The four base tickets (product/design/backend/frontend) are always
 *      drafted; the devops ticket is drafted ONLY when the BRD surfaced
 *      devOpsNotes, and is flagged needsHuman.
 *   2. The design ticket carries the request's prototype URL when set.
 *   3. Plan files are bucketed into the backend/frontend tickets by path.
 *   4. The product ticket's body carries the BRD narrative + acceptance
 *      criteria; it never includes devops notes (those stay on their own
 *      ticket, never folded into the task ticket).
 *
 * Run: npx tsx scripts/test-tickets.ts
 */

import { buildTicketPlan } from "../src/lib/agents/tickets";
import type { AgentContext, BrdResult, PlanResult } from "../src/lib/agents/types";
import type { Request } from "@prisma/client";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function fakeRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: "req_1",
    title: "Add CSV export to orders",
    description: "Let stakeholders export orders as CSV.",
    type: "FEATURE",
    status: "PLANNING",
    priority: "normal",
    repoFullName: null,
    jiraIssueKey: null,
    designPrototypeUrl: null,
    projectId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: "company_1",
    createdById: "user_1",
    ...overrides,
  } as Request;
}

function fakeCtx(overrides: Partial<Request> = {}): AgentContext {
  return {
    request: fakeRequest(overrides),
    log: async () => {},
  };
}

const brdNoDevOps: BrdResult = {
  narrative: "Stakeholders want to export orders as CSV from the orders list.",
  gherkin: "Feature: CSV export\n\n  Scenario: Export\n    Given orders\n    When exported\n    Then a CSV downloads",
  acceptanceCriteria: ["An export button appears on the orders list.", "The CSV contains all visible columns."],
  devOpsNotes: [],
  model: "test-model",
};

const brdWithDevOps: BrdResult = {
  ...brdNoDevOps,
  devOpsNotes: [
    "Add a RESEND_API_KEY env var on the Railway service for the export-ready email.",
    "Verify the sending domain in Resend before the email can go out.",
  ],
};

const plan: PlanResult = {
  summary: "Add a CSV export action to the orders list.",
  steps: ["Add an export API route", "Add an export button to the orders table"],
  files: [
    "src/app/api/orders/export/route.ts",
    "src/lib/orders/csv.ts",
    "src/components/OrdersTable.tsx",
    "src/app/(app)/orders/page.tsx",
  ],
};

function main() {
  console.log("delivery-ticket agent — pure logic\n");

  // 1. No devops notes → exactly 4 drafts, in order, none flagged needsHuman.
  const drafts = buildTicketPlan(fakeCtx(), brdNoDevOps, plan);
  check("drafts 4 tickets when there are no devops notes", drafts.length === 4, `got ${drafts.length}`);
  check(
    "kinds are product/design/backend/frontend in order",
    JSON.stringify(drafts.map((d) => d.kind)) === JSON.stringify(["product", "design", "backend", "frontend"])
  );
  check("none are flagged needsHuman", drafts.every((d) => !d.needsHuman));

  // 2. With devops notes → a 5th devops ticket, flagged needsHuman, carrying the notes.
  const withDevOps = buildTicketPlan(fakeCtx(), brdWithDevOps, plan);
  check("drafts 5 tickets when the BRD has devops notes", withDevOps.length === 5, `got ${withDevOps.length}`);
  const devopsTicket = withDevOps.find((d) => d.kind === "devops");
  check("devops ticket exists and is flagged needsHuman", !!devopsTicket?.needsHuman);
  check(
    "devops ticket body lists every devops note",
    brdWithDevOps.devOpsNotes.every((n) => devopsTicket?.body.includes(n))
  );
  check(
    "product ticket body never carries devops notes",
    !withDevOps.find((d) => d.kind === "product")?.body.includes("RESEND_API_KEY")
  );

  // 3. Design ticket carries the prototype URL when set, omits it when not.
  const withPrototype = buildTicketPlan(
    fakeCtx({ designPrototypeUrl: "https://figma.com/file/abc123" }),
    brdNoDevOps,
    plan
  );
  const designWith = withPrototype.find((d) => d.kind === "design");
  check("design ticket includes the prototype URL when set", !!designWith?.body.includes("https://figma.com/file/abc123"));
  const designWithout = drafts.find((d) => d.kind === "design");
  check("design ticket has no prototype line when unset", !designWithout?.body.includes("Prototype:"));

  // 4. Plan files are bucketed by path into backend/frontend tickets.
  const backendTicket = drafts.find((d) => d.kind === "backend");
  const frontendTicket = drafts.find((d) => d.kind === "frontend");
  check("backend ticket lists the API route file", !!backendTicket?.body.includes("src/app/api/orders/export/route.ts"));
  check("backend ticket lists the lib file", !!backendTicket?.body.includes("src/lib/orders/csv.ts"));
  check("frontend ticket lists the component file", !!frontendTicket?.body.includes("src/components/OrdersTable.tsx"));
  check("frontend ticket does not list the API route file", !frontendTicket?.body.includes("route.ts"));

  // 5. Product ticket carries narrative + acceptance criteria.
  const productTicket = drafts.find((d) => d.kind === "product");
  check("product ticket body includes the BRD narrative", !!productTicket?.body.includes(brdNoDevOps.narrative));
  check(
    "product ticket body includes every acceptance criterion",
    brdNoDevOps.acceptanceCriteria.every((c) => productTicket?.body.includes(c))
  );

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
