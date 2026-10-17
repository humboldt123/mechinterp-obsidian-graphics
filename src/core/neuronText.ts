import { renderInline, InlineOptions } from "./inline";
import { esc, num, parseBlock } from "./util";

/**
 * ```neuron-text
 * max: 240
 * meter: ,
 * caption: The commas stay dark until Colorado shows up.
 * ---
 * English | Please ap{pr:0.3}ove the {pr}oject {pr}oposal.
 * Base64  | `aHR0cHM6Ly9leGFtcGxlLmNvbS{9:.3}{wc}{m:.3}ljaW5nL{3By}b21v`
 *         | `aHR0cHM6Ly9leGFtcGxlLm9yZy{9:.3}{wc}{m:.3}Vzcy{9:.3}{wc}{m:.3}V2aWV3`
 * [Decode] -> https://example.com/{pr}icing/{pr}omo
 * Prompt  | **My plan for this weekend is to** go to the library
 * [Steer] <-> **My plan for this weekend is to** go to the mountains
 * ```
 *
 * `Label | text` starts a row, `| text` continues it on a new line (or starts
 * an unlabelled row after a blank line). `[Button] -> text` reveals text under
 * the row; `[Button] <-> text` swaps the row's text while pressed.
 */
interface Row {
  label: string;
  lines: string[];
  button?: { label: string; mode: "reveal" | "swap"; lines: string[] };
}

const ROW_RE = /^([^|[\]]*?)\s*\|\s?(.*)$/;
const BTN_RE = /^\[([^\]]+)\]\s*(<->|->)\s?(.*)$/;

export function parseRows(body: string[]): Row[] {
  const rows: Row[] = [];
  let cur: Row | undefined;
  let gap = false;
  for (const raw of body) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      gap = true;
      continue;
    }
    const b = line.trim().match(BTN_RE);
    if (b && cur) {
      if (cur.button && cur.button.label === b[1] && cur.button.mode === (b[2] === "<->" ? "swap" : "reveal")) cur.button.lines.push(b[3]);
      else cur.button = { label: b[1], mode: b[2] === "<->" ? "swap" : "reveal", lines: [b[3]] };
      gap = false;
      continue;
    }
    const r = line.match(ROW_RE);
    if (r) {
      const label = r[1].trim();
      if (label || !cur || gap || cur.button) {
        cur = { label, lines: [r[2]] };
        rows.push(cur);
      } else {
        cur.lines.push(r[2]);
      }
    } else if (cur && !gap) {
      cur.lines.push(line.trim());
    } else {
      cur = { label: "", lines: [line.trim()] };
      rows.push(cur);
    }
    gap = false;
  }
  return rows;
}

export function renderNeuronText(source: string): string {
  const { opts, body } = parseBlock(source);
  const inline: InlineOptions = { max: num(opts.max, 1), meter: opts.meter || undefined };
  const rows = parseRows(body);
  const labelled = rows.some((r) => r.label);
  const lines = (ls: string[]) => ls.map((l) => renderInline(l, inline)).join("<br>");

  let html = `<div class="mig mig-ntext${labelled ? "" : " mig-nolabels"}" data-mig="ntext">`;
  if (opts.title) html += `<div class="mig-title">${renderInline(opts.title)}</div>`;
  html += '<div class="mig-card">';
  for (const row of rows) {
    html += '<div class="mig-row">';
    if (labelled) html += `<div class="mig-label">${esc(row.label)}</div>`;
    const b = row.button;
    if (b?.mode === "swap") {
      html += `<div class="mig-content"><div class="mig-alt-a">${lines(row.lines)}</div><div class="mig-alt-b" hidden>${lines(b.lines)}</div></div>`;
    } else {
      html += `<div class="mig-content">${lines(row.lines)}</div>`;
    }
    if (b) {
      html += `<button type="button" class="mig-btn" data-mode="${b.mode}" aria-pressed="false">${esc(b.label)}</button>`;
      if (b.mode === "reveal") html += `<div class="mig-reveal" hidden>${lines(b.lines)}</div>`;
    }
    html += "</div>";
  }
  html += "</div>";
  if (opts.caption) html += `<div class="mig-caption">${renderInline(opts.caption)}</div>`;
  return html + "</div>";
}
