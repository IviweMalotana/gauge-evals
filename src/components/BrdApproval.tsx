"use client";

import { useState } from "react";
import { decideBrd } from "@/app/actions/requests";

/**
 * The human gate. Reviewers can accept the BRD as-is, reject it, or alter the
 * narrative/Gherkin and accept the edited version.
 */
export function BrdApproval({
  requestId,
  narrative,
  gherkin,
}: {
  requestId: string;
  narrative: string;
  gherkin: string;
}) {
  const [mode, setMode] = useState<"idle" | "alter" | "reject">("idle");

  return (
    <div className="card" style={{ borderColor: "var(--accent)" }}>
      <h3 style={{ marginTop: 0 }}>Your decision</h3>
      <p className="small muted">
        Nothing gets built until you approve. Accept to send it to the planner,
        alter the wording first, or reject to stop here.
      </p>

      {mode === "idle" && (
        <div className="row" style={{ gap: 10 }}>
          <form action={decideBrd}>
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="decision" value="ACCEPTED" />
            <button className="btn success" type="submit">
              Accept & build
            </button>
          </form>
          <button className="btn secondary" onClick={() => setMode("alter")}>
            Alter
          </button>
          <button className="btn danger" onClick={() => setMode("reject")}>
            Reject
          </button>
        </div>
      )}

      {mode === "alter" && (
        <form action={decideBrd}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="ALTERED" />
          <label htmlFor="narrative">Narrative</label>
          <textarea id="narrative" name="narrative" defaultValue={narrative} />
          <label htmlFor="gherkin">Gherkin (Given / When / Then)</label>
          <textarea
            id="gherkin"
            name="gherkin"
            defaultValue={gherkin}
            style={{ minHeight: 160 }}
            className="mono"
          />
          <label htmlFor="note">Change note (optional)</label>
          <input id="note" name="note" placeholder="What you changed and why" />
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn success" type="submit">
              Save changes & build
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setMode("idle")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "reject" && (
        <form action={decideBrd}>
          <input type="hidden" name="requestId" value={requestId} />
          <input type="hidden" name="decision" value="REJECTED" />
          <label htmlFor="note">Reason (optional)</label>
          <input id="note" name="note" placeholder="Why you're rejecting this" />
          <div className="row" style={{ marginTop: 12, gap: 10 }}>
            <button className="btn danger" type="submit">
              Confirm reject
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setMode("idle")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
