import { renderInline } from "./inline";
import { esc, num, parseBlock } from "./util";

/**
 * Anthropic-style feature dashboard.
 *
 * ```feature-card
 * title: Golden Gate Bridge
 * subtitle: 34M/31164353
 * description: Fires on mentions and images of the Golden Gate Bridge.
 * density: 0.0031%
 * histogram: 120 64 30 18 11 8 6 4 3 2 2 1
 * positive: " Bridge" 1.24, "Golden" 0.98, " Marin" 0.71
 * negative: " Eiffel" -0.42, " London" -0.30
 * show: 4
 * ---
 * Top activations
 * - the {Golden:0.9} {Gate} {Bridge:0.8} is a suspension bridge
 * Subsample interval 3
 * - drove across the {bridge:0.3} into Marin
 * ```
 *
 * Body lines starting with `-` are examples (same {token} markup as
 * neuron-text); any other line starts a new section.
 */
const LOGIT_RE = /\s*(?:"((?:\\.|[^"\\])*)"|([^,\s]+))\s+(-?(?:\d+\.?\d*|\.\d+))\s*(?:,|$)/g;

function parseLogits(v: string | undefined): [string, number][] {
  if (!v) return [];
  const out: [string, number][] = [];
  for (const m of v.matchAll(LOGIT_RE)) out.push([(m[1] ?? m[2]).replace(/\\(.)/g, "$1"), Number(m[3])]);
  return out;
}

function histogramSVG(counts: number[]): string {
  if (!counts.length) return "";
  const W = 220,
    H = 64,
    bw = W / counts.length,
    max = Math.max(...counts, 1);
  const bars = counts
    .map((c, i) => {
      const h = (c / max) * (H - 4);
      return `<rect x="${(i * bw + 0.5).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${h.toFixed(1)}" rx="1"></rect>`;
    })
    .join("");
  return `<svg class="mig-hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Activation density histogram">${bars}</svg>`;
}

function logitList(title: string, items: [string, number][], neg: boolean): string {
  if (!items.length) return "";
  const max = Math.max(...items.map(([, v]) => Math.abs(v)), 1e-9);
  let html = `<div class="mig-logits${neg ? " mig-neg" : ""}"><div class="mig-sec">${title}</div>`;
  for (const [tok, v] of items) {
    html += `<div class="mig-logit"><span class="mig-chip">${esc(tok.replace(/ /g, "\u2423"))}</span><span class="mig-lbar"><i style="width:${((Math.abs(v) / max) * 100).toFixed(1)}%"></i></span><span class="mig-lval">${v > 0 ? "+" : ""}${v.toFixed(2)}</span></div>`;
  }
  return html + "</div>";
}

export function renderFeatureCard(source: string): string {
  const { opts, body } = parseBlock(source);
  const max = num(opts.max, 1);
  const show = num(opts.show, 4);
  const sections: { title: string; examples: string[] }[] = [];
  for (const line of body) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith("- ")) {
      if (!sections.length) sections.push({ title: "Top activations", examples: [] });
      sections[sections.length - 1].examples.push(t.slice(2));
    } else sections.push({ title: t, examples: [] });
  }
  const hist = (opts.histogram ?? "").split(/[\s,]+/).filter(Boolean).map(Number).filter(Number.isFinite);

  let html = '<div class="mig mig-feature" data-mig="feature"><div class="mig-card">';
  html += '<div class="mig-fhead">';
  if (opts.title) html += `<div class="mig-title">${renderInline(opts.title)}</div>`;
  if (opts.subtitle) html += `<div class="mig-sub">${renderInline(opts.subtitle)}</div>`;
  html += "</div>";
  if (opts.description) html += `<div class="mig-fdesc">${renderInline(opts.description)}</div>`;
  html += '<div class="mig-fgrid"><div class="mig-fside">';
  if (hist.length) {
    html += `<div class="mig-sec">Activation density${opts.density ? ` <span class="mig-sub">${esc(opts.density)}</span>` : ""}</div>${histogramSVG(hist)}`;
  }
  html += logitList("Positive logits", parseLogits(opts.positive), false);
  html += logitList("Negative logits", parseLogits(opts.negative), true);
  html += '</div><div class="mig-fmain">';
  for (const s of sections) {
    html += `<div class="mig-sec">${renderInline(s.title)}</div><div class="mig-examples">`;
    s.examples.forEach((ex, i) => {
      html += `<div class="mig-ex"${i >= show ? " hidden" : ""}>${renderInline(ex, { max })}</div>`;
    });
    if (s.examples.length > show) {
      html += `<button type="button" class="mig-more" data-more="${s.examples.length - show}">Show ${s.examples.length - show} more</button>`;
    }
    html += "</div>";
  }
  html += "</div></div></div>";
  if (opts.caption) html += `<div class="mig-caption">${renderInline(opts.caption)}</div>`;
  return html + "</div>";
}
