import { db } from "../db";
import { decryptSecret } from "../crypto";
import type { Request } from "@prisma/client";
import type { RequestStatus } from "../domain";
import type { AgentContext } from "./types";
import { runUxCheck } from "./uxCheck";
import { runBrd } from "./brd";
import { runPlanner } from "./planner";
import { runBuilder } from "./builder";
import { runAcceptance, runBugFix, runRegression } from "./tester";
import { runPr } from "./pr";
import type { VerificationResult } from "./types";

/**
 * The pipeline runs in two halves with a human-approval gate between them:
 *
 *   Phase 1 (runToApproval):  INTAKE → UX_CHECK → BRD_DRAFTING → AWAITING_APPROVAL
 *   [human accepts / alters the BRD]
 *   Phase 2 (runAfterApproval): PLANNING → BUILDING → TESTING → PR_CREATED → DONE
 *
 * Stages are awaited sequentially and each persists its artifact + an audit
 * event. Any thrown error moves the request to FAILED and is recorded.
 */

async function buildContext(request: Request): Promise<AgentContext> {
  const company = await db.company.findUnique({
    where: { id: request.companyId },
    select: { githubDefaultRepo: true, appBaseUrl: true, githubAccessToken: true },
  });
  return {
    request,
    repo: company?.githubDefaultRepo ?? null,
    appBaseUrl: company?.appBaseUrl ?? null,
    githubToken: decryptSecret(company?.githubAccessToken),
    log: (message, data) =>
      logEvent(request.id, statusToStage(request.status), message, data),
  };
}

function statusToStage(status: string): string {
  return status.toLowerCase();
}

export async function logEvent(
  requestId: string,
  stage: string,
  message: string,
  data?: unknown,
  level: "info" | "warn" | "error" = "info"
): Promise<void> {
  await db.pipelineEvent.create({
    data: {
      requestId,
      stage,
      level,
      message,
      data: data === undefined ? null : JSON.stringify(data),
    },
  });
}

async function setStatus(requestId: string, status: RequestStatus): Promise<Request> {
  return db.request.update({ where: { id: requestId }, data: { status } });
}

/** Phase 1: intake → UX check → BRD, then pause for human approval. */
export async function runToApproval(requestId: string): Promise<void> {
  let request = await db.request.findUniqueOrThrow({ where: { id: requestId } });

  try {
    // --- UX check ---
    request = await setStatus(requestId, "UX_CHECK");
    let ctx = await buildContext(request);
    await logEvent(requestId, "ux_check", "UX-check agent started.");
    const ux = await runUxCheck(ctx);
    await db.uxCheck.upsert({
      where: { requestId },
      create: {
        requestId,
        classifiedType: ux.classifiedType,
        reproduced: ux.reproduced,
        summary: ux.summary,
        steps: JSON.stringify(ux.steps),
        screenshots: JSON.stringify(ux.screenshots),
      },
      update: {
        classifiedType: ux.classifiedType,
        reproduced: ux.reproduced,
        summary: ux.summary,
        steps: JSON.stringify(ux.steps),
        screenshots: JSON.stringify(ux.screenshots),
      },
    });
    await db.request.update({
      where: { id: requestId },
      data: { type: ux.classifiedType },
    });

    // --- BRD ---
    request = await setStatus(requestId, "BRD_DRAFTING");
    ctx = await buildContext(request);
    await logEvent(requestId, "brd", "BRD agent started.");
    const brd = await runBrd(ctx, ux);
    await db.brd.upsert({
      where: { requestId },
      create: {
        requestId,
        narrative: brd.narrative,
        gherkin: brd.gherkin,
        acceptanceCriteria: JSON.stringify(brd.acceptanceCriteria),
        model: brd.model,
      },
      update: {
        narrative: brd.narrative,
        gherkin: brd.gherkin,
        acceptanceCriteria: JSON.stringify(brd.acceptanceCriteria),
        model: brd.model,
        version: { increment: 1 },
      },
    });

    await setStatus(requestId, "AWAITING_APPROVAL");
    await logEvent(requestId, "approval", "BRD ready — awaiting human decision.");
  } catch (err) {
    await failRequest(requestId, err);
  }
}

/** Phase 2: after approval → plan → build → test → PR. */
export async function runAfterApproval(requestId: string): Promise<void> {
  let request = await db.request.findUniqueOrThrow({ where: { id: requestId } });
  const brdRow = await db.brd.findUnique({ where: { requestId } });
  if (!brdRow) throw new Error("Cannot run build phase before a BRD exists");
  const brd = {
    narrative: brdRow.narrative,
    gherkin: brdRow.gherkin,
    acceptanceCriteria: JSON.parse(brdRow.acceptanceCriteria) as string[],
    model: brdRow.model,
  };

  try {
    // --- Planner ---
    request = await setStatus(requestId, "PLANNING");
    let ctx = await buildContext(request);
    await logEvent(requestId, "planner", "Planner agent started.");
    const plan = await runPlanner(ctx, brd);
    await db.plan.upsert({
      where: { requestId },
      create: {
        requestId,
        summary: plan.summary,
        steps: JSON.stringify(plan.steps),
        files: JSON.stringify(plan.files),
      },
      update: {
        summary: plan.summary,
        steps: JSON.stringify(plan.steps),
        files: JSON.stringify(plan.files),
      },
    });

    // --- Builder ---
    request = await setStatus(requestId, "BUILDING");
    ctx = await buildContext(request);
    await logEvent(requestId, "builder", "Builder agent started.");
    const build = await runBuilder(ctx, plan, brd);
    await db.build.upsert({
      where: { requestId },
      create: { requestId, branch: build.branch, summary: build.summary, diff: build.diff },
      update: { branch: build.branch, summary: build.summary, diff: build.diff },
    });

    // --- Verification: acceptance → bug-fix review → regression ---
    // Each is its own stage. Any failing check stops before the PR.

    request = await setStatus(requestId, "TESTING");
    ctx = await buildContext(request);
    await logEvent(requestId, "acceptance", "Acceptance testing started.");
    const acceptance = await runAcceptance(ctx, build, brd);
    await persistCheck(requestId, acceptance);
    if (!acceptance.passed) return stopFailed(requestId, "acceptance", acceptance.summary);

    request = await setStatus(requestId, "BUGFIX_REVIEW");
    ctx = await buildContext(request);
    const bugfix = await runBugFix(ctx);
    if (bugfix) {
      await persistCheck(requestId, bugfix);
      if (!bugfix.passed) return stopFailed(requestId, "bugfix", bugfix.summary);
    }

    request = await setStatus(requestId, "REGRESSION");
    ctx = await buildContext(request);
    const regression = await runRegression(ctx, brd);
    if (regression) {
      await persistCheck(requestId, regression);
      if (!regression.passed) return stopFailed(requestId, "regression", regression.summary);
    }

    // --- PR ---
    request = await setStatus(requestId, "PR_CREATED");
    ctx = await buildContext(request);
    await logEvent(requestId, "pr", "PR agent started.");
    const pr = await runPr(ctx, build, brd);
    await db.pullRequestRef.upsert({
      where: { requestId },
      create: { requestId, number: pr.number, url: pr.url, title: pr.title },
      update: { number: pr.number, url: pr.url, title: pr.title },
    });

    await setStatus(requestId, "DONE");
    await logEvent(requestId, "pr", "Pull request created — pipeline complete.", { url: pr.url });
  } catch (err) {
    await failRequest(requestId, err);
  }
}

async function persistCheck(requestId: string, r: VerificationResult): Promise<void> {
  const data = {
    passed: r.passed,
    summary: r.summary,
    output: JSON.stringify(r.output),
    screenshots: JSON.stringify(r.screenshots),
  };
  await db.verificationCheck.upsert({
    where: { requestId_kind: { requestId, kind: r.kind } },
    create: { requestId, kind: r.kind, ...data },
    update: data,
  });
  await logEvent(requestId, r.kind, r.summary, { passed: r.passed }, r.passed ? "info" : "warn");
}

async function stopFailed(requestId: string, stage: string, summary: string): Promise<void> {
  await setStatus(requestId, "FAILED");
  await logEvent(requestId, stage, `${summary} Stopping before PR.`, undefined, "error");
}

async function failRequest(requestId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  await db.request.update({ where: { id: requestId }, data: { status: "FAILED" } });
  await logEvent(requestId, "pipeline", `Stage failed: ${message}`, undefined, "error");
}
