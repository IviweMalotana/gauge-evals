import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Gauge — stakeholder request pipeline",
  description:
    "Companies file stakeholder requests; agents run a UX check, draft a BRD, and — after human approval — plan, build, test, and open a PR.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
