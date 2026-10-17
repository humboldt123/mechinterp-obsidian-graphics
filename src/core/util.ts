/** How a renderer turns a vault path (`Assets/Data/x.json`) into a URL the browser can fetch. */
export interface RenderContext {
  resolve(path: string): string;
}

export interface ParsedBlock {
  opts: Record<string, string>;
  body: string[];
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const OPT_RE = /^([a-z][\w-]*):\s?(.*)$/i;

/**
 * Splits a code block into `key: value` options and the body.
 * With a `---` line, everything above it is options. Without one, the
 * leading lines that look like `key: value` are options.
 */
export function parseBlock(source: string): ParsedBlock {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const sep = lines.findIndex((l) => l.trim() === "---");
  const opts: Record<string, string> = {};
  let start = 0;
  if (sep >= 0) {
    for (const l of lines.slice(0, sep)) {
      const m = l.match(OPT_RE);
      if (m) opts[m[1].toLowerCase()] = m[2].trim();
    }
    start = sep + 1;
  } else {
    while (start < lines.length) {
      const l = lines[start];
      if (!l.trim()) {
        start++;
        continue;
      }
      const m = l.match(OPT_RE);
      if (!m) break;
      opts[m[1].toLowerCase()] = m[2].trim();
      start++;
    }
  }
  const body = lines.slice(start);
  while (body.length && !body[body.length - 1].trim()) body.pop();
  return { opts, body };
}

export function num(v: string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return !/^(false|no|off|0|none)$/i.test(v);
}

export function errorBox(lang: string, message: string): string {
  return `<div class="mig mig-error"><b>${esc(lang)}</b>: ${esc(message)}</div>`;
}
