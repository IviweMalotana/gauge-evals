/**
 * Unit test for the multi-repo pure helpers (no DB). Verifies:
 *   1. normalizeRepoFullName accepts owner/name (and strips URLs/.git), rejects junk,
 *   2. resolveRepoForRequest picks the request's repo only when still connected,
 *      else the company default.
 *
 * Run: npx tsx scripts/test-repos.ts
 */

import { normalizeRepoFullName, resolveRepoForRequest } from "../src/lib/repos";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function main() {
  console.log("multi-repo — pure helpers\n");

  console.log("normalizeRepoFullName");
  check("accepts owner/name", normalizeRepoFullName("acme/webapp") === "acme/webapp");
  check("strips a github URL", normalizeRepoFullName("https://github.com/acme/webapp") === "acme/webapp");
  check("strips a trailing .git", normalizeRepoFullName("acme/webapp.git") === "acme/webapp");
  check("trims whitespace", normalizeRepoFullName("  acme/webapp  ") === "acme/webapp");
  check("rejects a bare name", normalizeRepoFullName("webapp") === null);
  check("rejects extra segments", normalizeRepoFullName("acme/team/webapp") === null);
  check("rejects spaces in name", normalizeRepoFullName("acme/web app") === null);
  check("rejects empty", normalizeRepoFullName("") === null && normalizeRepoFullName(null) === null);

  console.log("\nresolveRepoForRequest");
  const connected = ["acme/webapp", "acme/api"];
  check("uses the request repo when connected", resolveRepoForRequest("acme/api", connected, "acme/webapp") === "acme/api");
  check("falls back to default when request repo not connected", resolveRepoForRequest("acme/gone", connected, "acme/webapp") === "acme/webapp");
  check("falls back to default when request repo empty", resolveRepoForRequest(null, connected, "acme/webapp") === "acme/webapp");
  check("null when nothing available", resolveRepoForRequest(null, [], null) === null);

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: multi-repo helpers validate and resolve repos correctly.");
}

main();
