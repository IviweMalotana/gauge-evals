/**
 * Regression test for the builder's duplicate-copy guard.
 *
 * Live bug (PR #28): a request to add a "Welcome back" subtitle was built by
 * INSERTING a second paragraph, even though the login page already rendered
 * `<p className="small">Welcome back.</p>`. The result: "Welcome back" shown
 * twice. detectDuplicateCopy compares the proposed file against the existing one
 * and flags user-visible text the change duplicates.
 *
 * Run: npx tsx scripts/test-duplicate-copy.ts
 */

import {
  detectDuplicateCopy,
  extractVisibleText,
} from "../src/lib/agents/builder";

let failures = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const OLD = `export default function LoginPage() {
  return (
    <div className="card">
      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>
      <p className="small">Welcome back.</p>
      <form>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}`;

// The builder's actual output: a SECOND "Welcome back" above the form.
const NEW_DUPLICATE = `export default function LoginPage() {
  return (
    <div className="card">
      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>
      <p className="small">Welcome back.</p>
      <p className="muted" style={{ marginTop: 0, marginBottom: 20, fontSize: 15 }}>
        Welcome back
      </p>
      <form>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}`;

// The correct build: EDIT the existing subtitle instead of adding one.
const NEW_EDIT = `export default function LoginPage() {
  return (
    <div className="card">
      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>
      <p className="small">Welcome back — please sign in.</p>
      <form>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}`;

// An unrelated, genuinely-new subtitle (no existing near-duplicate).
const NEW_DISTINCT = `export default function LoginPage() {
  return (
    <div className="card">
      <h1 style={{ fontSize: 28 }}>Sign in to Baton</h1>
      <p className="small">Welcome back.</p>
      <p className="muted">Enter your team credentials to continue.</p>
      <form>
        <button type="submit">Sign in</button>
      </form>
    </div>
  );
}`;

function main() {
  console.log("builder — duplicate-copy guard\n");

  console.log("extractVisibleText");
  const texts = extractVisibleText(OLD);
  check("pulls JSX text nodes", texts.includes("Sign in to Baton") && texts.includes("Welcome back."));
  check("ignores expressions/short noise", !texts.some((t) => t.includes("{")));

  console.log("\ndetectDuplicateCopy — the PR #28 case");
  const dups = detectDuplicateCopy(OLD, NEW_DUPLICATE);
  check("flags the duplicated 'Welcome back'", dups.length === 1, JSON.stringify(dups));
  check(
    "reports the added text and the existing text",
    dups.length === 1 && /welcome back/i.test(dups[0].added) && /welcome back/i.test(dups[0].existing)
  );

  console.log("\nno false positives");
  check("editing the existing subtitle is NOT flagged", detectDuplicateCopy(OLD, NEW_EDIT).length === 0, JSON.stringify(detectDuplicateCopy(OLD, NEW_EDIT)));
  check("a genuinely distinct new subtitle is NOT flagged", detectDuplicateCopy(OLD, NEW_DISTINCT).length === 0, JSON.stringify(detectDuplicateCopy(OLD, NEW_DISTINCT)));
  check("no change → no duplicates", detectDuplicateCopy(OLD, OLD).length === 0);

  console.log("");
  if (failures > 0) {
    console.error(`FAILED: ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("PASSED: duplicate-copy guard catches repeated page text without false positives.");
}

main();
