// Types mirroring the FastAPI backend schemas (app/schemas.py).

export interface Meta {
  demo_mode: boolean;
  default_model: string;
}

export interface Case {
  id: number;
  dataset_id: number;
  name: string;
  input: string;
  expected: string | null;
  rubric: string | null;
  order_index: number;
}

export interface Dataset {
  id: number;
  task_id: number;
  name: string;
  description: string;
  created_at: string;
}

export interface DatasetWithCases extends Dataset {
  cases: Case[];
}

export interface ScorerConfig {
  name: string;
  type: string;
  weight: number;
  config?: Record<string, unknown>;
}

export interface Task {
  id: number;
  slug: string;
  name: string;
  description: string;
  input_label: string;
  output_label: string;
  created_at: string;
}

export interface TaskDetail extends Task {
  system_prompt: string;
  prompt_template: string;
  default_scorers: ScorerConfig[];
  datasets: Dataset[];
}

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunSummary {
  id: number;
  task_id: number;
  dataset_id: number;
  label: string;
  model: string;
  params: Record<string, unknown>;
  status: RunStatus;
  is_mock: boolean;
  pass_threshold: number;
  progress_done: number;
  progress_total: number;
  total_cases: number;
  passed: number;
  failed: number;
  error_count: number;
  avg_score: number;
  pass_rate: number;
  avg_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  notes: string;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ScoreEntry {
  name: string;
  type: string;
  weight: number;
  score: number;
  passed: boolean;
  detail?: string;
  reasoning?: string;
}

export interface Result {
  id: number;
  case_id: number;
  output: string | null;
  scores: ScoreEntry[];
  score: number;
  passed: boolean;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  error: string | null;
}

export interface ResultWithCase extends Result {
  case: Case;
}

export interface RunDetail extends RunSummary {
  scorers: ScorerConfig[];
  results: ResultWithCase[];
}

// ── Run comparison / diff ──────────────────────────────────────────────

export type DiffStatus = "improved" | "regressed" | "unchanged" | "missing";

export interface CompareCaseRow {
  case: Case;
  base: Result | null;
  compare: Result | null;
  score_delta: number;
  latency_delta: number;
  status: DiffStatus;
}

export interface CompareSummary {
  improved: number;
  regressed: number;
  unchanged: number;
  passed_delta: number;
  score_delta: number;
  pass_rate_delta: number;
  cost_delta: number;
  latency_delta: number;
}

export interface CompareResponse {
  base: RunSummary;
  compare: RunSummary;
  summary: CompareSummary;
  rows: CompareCaseRow[];
}
