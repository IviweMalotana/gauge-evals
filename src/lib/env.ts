/**
 * Centralized environment access. Keeps `process.env` lookups in one place and
 * makes it obvious which features degrade gracefully when a secret is missing.
 */

export const env = {
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me",

  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
};

export const features = {
  /** GitHub OAuth is only usable when the OAuth app credentials are present. */
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  /** The BRD agent falls back to a deterministic draft when no API key is set. */
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
};
