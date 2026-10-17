import { renderInline } from "./inline";
import { esc, parseBlock } from "./util";

/**
 * A conversation as chat bubbles.
 *
 * ```chat
 * me: Vish
 * ---
 * Vish: one hot encoding works for as many tokens as you have…
 * Claude: You're right to be concerned about efficiency…
 *   a line without a speaker continues the previous message
 * ```
 *
 * `me:` names the speaker drawn on the right (default: the first speaker).
 * `colors: Claude=orange, Vish=blue` sets bubble colors: orange, red, blue,
 * green, purple, gray, accent, or any CSS color. Claude defaults to orange,
 * `me` to the theme accent, everyone else to gray.
 */
const PALETTE: Record<string, string> = {
  orange: "#d97757", // Anthropic's Claude orange
  red: "#c2463d",
  blue: "#3b6fb6",
  green: "#3f8a5b",
  purple: "#7b5cc2",
  gray: "#6b6f76",
  grey: "#6b6f76",
  accent: "var(--mig-accent)",
};

function parseColors(v: string | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (v ?? "").split(",")) {
    const m = part.match(/^\s*([^=]+?)\s*=\s*(\S+)\s*$/);
    if (!m) continue;
    const c = PALETTE[m[2].toLowerCase()] ?? m[2];
    // Only plain CSS color tokens: no quotes, semicolons or url().
    if (/^(#[0-9a-f]{3,8}|[a-z]+|var\(--[\w-]+\)|(rgb|hsl)a?\([\d\s.,%/]+\))$/i.test(c)) out.set(m[1].toLowerCase(), c);
  }
  return out;
}
const OPTION_KEYS = new Set(["me", "colors", "caption"]);

/** With `---`, the usual split. Without it, only known keys count as options, so "Vish: hi" stays a message. */
function chatParts(source: string) {
  if (/^---\s*$/m.test(source)) return parseBlock(source);
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const opts: Record<string, string> = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^([a-z]+):\s?(.*)$/);
    if (!m || !OPTION_KEYS.has(m[1])) break;
    opts[m[1]] = m[2].trim();
  }
  return { opts, body: lines.slice(i) };
}

const SPEAKER_RE = /^([^\s:|][^:|]{0,30}):\s+(.*)$/;

export function renderChat(source: string): string {
  const { opts, body } = chatParts(source);
  const msgs: { who: string; lines: string[] }[] = [];
  for (const raw of body) {
    const line = raw.trim();
    if (!line) {
      if (msgs.length) msgs[msgs.length - 1].lines.push("");
      continue;
    }
    const m = line.match(SPEAKER_RE);
    if (m && !raw.match(/^\s/)) msgs.push({ who: m[1].trim(), lines: [m[2]] });
    else if (msgs.length) msgs[msgs.length - 1].lines.push(line);
    else msgs.push({ who: "", lines: [line] });
  }
  const me = opts.me || msgs.find((m) => m.who)?.who || "";
  const colors = parseColors(opts.colors);
  const colorOf = (who: string) =>
    colors.get(who.toLowerCase()) ?? (who === me ? PALETTE.accent : /^claude\b/i.test(who) ? PALETTE.orange : PALETTE.gray);
  let html = '<div class="mig mig-chat">';
  let prev = "";
  for (const m of msgs) {
    while (m.lines.length && !m.lines[m.lines.length - 1]) m.lines.pop();
    const mine = m.who === me;
    const text = m.lines.map((l) => renderInline(l)).join("<br>");
    html += `<div class="mig-msg${mine ? " mig-me" : ""}">`;
    if (m.who && m.who !== prev) html += `<div class="mig-who">${esc(m.who)}</div>`;
    html += `<div class="mig-bubble" style="--bubble:${esc(colorOf(m.who))}">${text}</div></div>`;
    prev = m.who;
  }
  if (opts.caption) html += `<div class="mig-caption">${renderInline(opts.caption)}</div>`;
  return html + "</div>";
}
