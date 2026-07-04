import type { Request } from "@prisma/client";
import type { RequestType } from "../domain";

/**
 * Every agent stage receives the request it operates on plus a logger to append
 * to the pipeline audit trail, and returns a structured result the orchestrator
 * persists. Keeping this uniform is what lets us swap a stub for a real
 * implementation (Playwright, a real builder, etc.) without touching the
 * orchestrator.
 */
export interface AgentContext {
  request: Request;
  /** Company GitHub repo the pipeline targets, if connected. */
  repo?: string | null;
  /** Base URL of the company's running app, for the UX-check browser pass. */
  appBaseUrl?: string | null;
  /** Company's stored GitHub OAuth token, for the PR agent. */
  githubToken?: string | null;
  log: (message: string, data?: unknown) => Promise<void>;
}

export interface UxCheckResult {
  classifiedType: Exclude<RequestType, "UNKNOWN">;
  reproduced: boolean;
  summary: string;
  steps: string[];
  screenshots: string[];
}

export interface BrdResult {
  narrative: string;
  gherkin: string;
  acceptanceCriteria: string[];
  model: string;
}

export interface PlanResult {
  summary: string;
  steps: string[];
  files: string[];
}

export interface BuildResult {
  branch: string;
  summary: string;
  diff: string;
}

export interface TestResult {
  passed: boolean;
  summary: string;
  output: string[];
}

export interface PrResult {
  number: number | null;
  url: string;
  title: string;
}
