"use client";

import { useState } from "react";

/** Read-only URL field with a one-click copy button (share links). */
export function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="row" style={{ marginTop: 6 }}>
      <input
        readOnly
        value={value}
        className="mono"
        onFocus={(e) => e.currentTarget.select()}
        style={{ flex: 1 }}
      />
      <button
        type="button"
        className="btn secondary small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard unavailable (http, permissions) — the field still selects on focus.
          }
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
