import { esc } from "./util";

/**
 * Inline markup shared by every block:
 *
 *   {text}        token at full activation
 *   {text:0.4}    token at 40% of max
 *   {text=112}    raw activation, divided by the block's `max`
 *   {text:-0.3}   negative activations are drawn blue
 *   `code`        monospace (tokens still work inside)
 *   **bold**, *italic*, [label](https://url)
 *   \{ \} \`      literal characters
 */
export interface InlineOptions {
  max?: number;
  /** Draw a small bar after every occurrence of this token (e.g. ","). */
  meter?: string;
}

const TOKEN_RE = /\{((?:\\.|[^{}\\])+)\}/g;
const VALUE_RE = /^([\s\S]*?)([:=])(-?(?:\d+\.?\d*|\.\d+))$/;

interface Token {
  text: string;
  value: number;
  raw: number;
}

function parseToken(inner: string, max: number): Token {
  const unescaped = inner.replace(/\\(.)/g, "$1");
  const m = unescaped.match(VALUE_RE);
  if (!m || m[1] === "") return { text: unescaped, value: 1, raw: max };
  const raw = Number(m[3]);
  const value = m[2] === "=" ? raw / max : raw;
  return { text: m[1], value, raw: m[2] === "=" ? raw : raw * max };
}

function fmt(n: number): string {
  const a = Math.abs(n);
  return a >= 100 ? n.toFixed(0) : a >= 10 ? n.toFixed(1) : n.toFixed(2);
}

function tokenHTML(t: Token, opts: InlineOptions): string {
  const v = Math.max(-1, Math.min(1, t.value));
  const alpha = Math.pow(Math.abs(v), 0.85);
  const cls = v < 0 ? "mig-tok mig-neg" : "mig-tok";
  const title = opts.max && opts.max !== 1 ? `${fmt(t.raw)} (${Math.round(v * 100)}% of max)` : `${Math.round(v * 100)}% of max`;
  // A leading space is kept outside the highlight, like a tokenizer's "Ġ".
  const lead = t.text.match(/^\s*/)![0];
  const body = t.text.slice(lead.length) || " ";
  let html = esc(lead) + `<span class="${cls}" style="--a:${alpha.toFixed(3)}" title="${esc(title)}">${esc(body)}</span>`;
  if (opts.meter && body === opts.meter) html += meterHTML(Math.max(0, v));
  return html;
}

function meterHTML(v: number): string {
  if (v < 0.04) return '<span class="mig-meter is-zero"></span>';
  return `<span class="mig-meter" style="--h:${v.toFixed(3)}"></span>`;
}

const PH = "\u0000";

function renderText(src: string, opts: InlineOptions, mono: boolean): string {
  const max = opts.max ?? 1;
  const saved: string[] = [];
  const hold = (html: string) => `${PH}${saved.push(html) - 1}${PH}`;

  // Escapes and tokens first, so ** inside a token stays literal.
  let s = src.replace(/\\([{}`*\\[\]])/g, (_, c: string) => hold(esc(c)));
  s = s.replace(TOKEN_RE, (_, inner: string) => hold(tokenHTML(parseToken(inner, max), opts)));
  if (!mono) {
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label: string, url: string) =>
      hold(`<a href="${esc(url)}" class="external-link" target="_blank" rel="noopener">${esc(label)}</a>`),
    );
  }
  s = esc(s);
  if (!mono) {
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>");
  }
  if (opts.meter) {
    const m = esc(opts.meter);
    s = s.split(m).join(m + meterHTML(0));
  }
  return s.replace(new RegExp(`${PH}(\\d+)${PH}`, "g"), (_, i: string) => saved[Number(i)]);
}

export function renderInline(src: string, opts: InlineOptions = {}): string {
  // Split on unescaped backticks: odd parts are monospace.
  const parts = src.split(/(?<!\\)`/);
  return parts
    .map((p, i) => (i % 2 ? `<span class="mig-mono">${renderText(p, opts, true)}</span>` : renderText(p, opts, false)))
    .join("");
}
