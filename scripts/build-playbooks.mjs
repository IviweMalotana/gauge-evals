#!/usr/bin/env node
/**
 * Compiles playbooks/*.md into one self-contained, shareable HTML handbook
 * (playbooks/instarc-delivery-os.html): clickable table of contents, inline
 * CSS, no external assets. Markdown is the source of truth — adjust a
 * playbook, re-run this, reshare the file.
 *
 * The converter supports exactly the markdown these docs use: #/##/### headings,
 * paragraphs, -/1. lists (incl. [ ] checkboxes), pipe tables, ``` code fences,
 * and inline bold / code / links.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "playbooks");
const outFile = join(srcDir, "instarc-delivery-os.html");

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Inline markdown: escape first, then bold / code / links on the escaped text. */
function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, text, href) =>
      // Cross-doc .md links become in-page anchors; anything else stays as-is.
      `<a href="${href.endsWith(".md") ? "#" + href.replace(/\.md$/, "") : href}">${text}</a>`
  );
  out = out.replace(/- \[ \] /g, "");
  return out;
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function mdToHtml(md, docId) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  const headings = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i++]);
      i++;
      out.push(`<pre>${esc(buf.join("\n"))}</pre>`);
      continue;
    }

    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      const id = level === 1 ? docId : `${docId}-${slug(text)}`;
      headings.push({ level, text, id });
      out.push(`<h${level + 1} id="${id}">${inline(text)}</h${level + 1}>`);
      i++;
      continue;
    }

    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(lines[i].replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        i++;
      }
      const [head, sep, ...body] = rows;
      const isSep = sep && sep.every((c) => /^:?-+:?$/.test(c));
      const bodyRows = isSep ? body : rows.slice(1);
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head
          .map((c) => `<th>${inline(c)}</th>`)
          .join("")}</tr></thead><tbody>${bodyRows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    const listMatch = line.match(/^(- |\d+\. )/);
    if (listMatch) {
      const ordered = /^\d/.test(line);
      const items = [];
      while (i < lines.length && (/^(- |\d+\. )/.test(lines[i]) || /^ {2,}\S/.test(lines[i]))) {
        if (/^(- |\d+\. )/.test(lines[i])) {
          const check = /^- \[ \] /.test(lines[i]);
          items.push({ check, text: lines[i].replace(/^(- \[ \] |- |\d+\. )/, "") });
        } else {
          // Continuation line of the previous item.
          items[items.length - 1].text += " " + lines[i].trim();
        }
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(
        `<${tag}>${items
          .map(
            (it) =>
              `<li>${it.check ? '<span class="check">☐</span> ' : ""}${inline(it.text)}</li>`
          )
          .join("")}</${tag}>`
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: gather until blank line or a structural line.
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3} |\||- |\d+\. |```)/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  return { html: out.join("\n"), headings };
}

const files = readdirSync(srcDir)
  .filter((f) => /^\d\d-.*\.md$/.test(f))
  .sort();

const docs = files.map((f) => {
  const docId = f.replace(/\.md$/, "");
  const { html, headings } = mdToHtml(readFileSync(join(srcDir, f), "utf8"), docId);
  return { docId, html, headings };
});

const toc = docs
  .map((d) => {
    const h1 = d.headings.find((h) => h.level === 1);
    const subs = d.headings.filter((h) => h.level === 2);
    return `<li><a href="#${d.docId}">${esc(h1?.text ?? d.docId)}</a>${
      subs.length
        ? `<ul>${subs.map((s) => `<li><a href="#${s.id}">${esc(s.text)}</a></li>`).join("")}</ul>`
        : ""
    }</li>`;
  })
  .join("\n");

const today = new Date().toISOString().slice(0, 10);

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instarc Delivery Operating System — Playbooks</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f6fa; color: #1c2330;
         font: 15px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .page { max-width: 900px; margin: 0 auto; padding: 44px 32px 72px; background: #fff;
          min-height: 100vh; border-left: 1px solid #e3e7ee; border-right: 1px solid #e3e7ee; }
  header { border-bottom: 2px solid #1c2330; padding-bottom: 20px; margin-bottom: 26px; }
  .badge { display: inline-block; font-size: 12px; font-weight: 600; letter-spacing: .4px;
           text-transform: uppercase; color: #3d5af1; border: 1px solid #3d5af1;
           border-radius: 999px; padding: 2px 10px; margin: 0 8px 10px 0; }
  h1 { margin: 0 0 6px; font-size: 30px; line-height: 1.2; }
  .meta { color: #5b6575; font-size: 13px; }
  nav.toc { background: #f4f6fa; border: 1px solid #e3e7ee; border-radius: 10px;
            padding: 18px 22px; margin-bottom: 34px; }
  nav.toc h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .5px; color: #5b6575; }
  nav.toc ul { margin: 0; padding-left: 18px; }
  nav.toc > ul > li { margin: 6px 0; font-weight: 600; }
  nav.toc ul ul { font-weight: 400; font-size: 13.5px; margin: 2px 0 4px; }
  a { color: #3d5af1; text-decoration: none; }
  a:hover { text-decoration: underline; }
  h2 { font-size: 24px; margin: 48px 0 10px; padding-top: 22px; border-top: 2px solid #1c2330; }
  h3 { font-size: 17px; margin: 26px 0 8px; border-bottom: 1px solid #e3e7ee; padding-bottom: 6px; }
  h4 { font-size: 15px; margin: 20px 0 6px; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 14px; padding-left: 24px; }
  li { margin: 4px 0; }
  .check { color: #3d5af1; }
  code { background: #f0f2f7; border: 1px solid #e3e7ee; border-radius: 4px;
         padding: 1px 5px; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: #f4f6fa; border: 1px solid #e3e7ee; border-radius: 8px; padding: 14px;
        overflow-x: auto; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .table-wrap { overflow-x: auto; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  th, td { text-align: left; padding: 8px 10px; border: 1px solid #e3e7ee; vertical-align: top; }
  th { background: #f4f6fa; font-size: 12px; text-transform: uppercase; letter-spacing: .3px; }
  tr:nth-child(even) td { background: #fafbfd; }
  footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #e3e7ee; color: #5b6575; font-size: 12.5px; }
  @media print { body { background: #fff; } .page { border: none; padding: 0; } h2 { break-before: page; } }
</style>
</head>
<body>
<div class="page">
  <header>
    <div>
      <span class="badge">Delivery Operating System</span>
      <span class="badge">PMBOK · Lean · Agile</span>
    </div>
    <h1>Instarc Delivery Operating System</h1>
    <div class="meta">Technical Delivery &amp; Platform Manager — playbook handbook · built ${today}</div>
  </header>
  <nav class="toc">
    <h2>Contents</h2>
    <ul>
${toc}
    </ul>
  </nav>
${docs.map((d) => d.html).join("\n")}
  <footer>Source of truth: <code>playbooks/*.md</code> — edit there and re-run <code>node scripts/build-playbooks.mjs</code>.</footer>
</div>
</body>
</html>`;

writeFileSync(outFile, page);
console.log(
  `Built ${outFile} — ${docs.length} playbooks, ${Math.round(page.length / 1024)} KB`
);
