"use client";

import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

export function ManageSpaceTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <>
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab${active === t.id ? " active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} style={{ display: active === t.id ? "block" : "none" }}>
          {t.content}
        </div>
      ))}
    </>
  );
}
