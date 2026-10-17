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
 */
const SPEAKER_RE = /^([^\s:|][^:|]{0,30}):\s+(.*)$/;

export function renderChat(source: string): string {
  const { opts, body } = parseBlock(source);
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
  let html = '<div class="mig mig-chat">';
  let prev = "";
  for (const m of msgs) {
    while (m.lines.length && !m.lines[m.lines.length - 1]) m.lines.pop();
    const mine = m.who === me;
    const text = m.lines.map((l) => renderInline(l)).join("<br>");
    html += `<div class="mig-msg${mine ? " mig-me" : ""}">`;
    if (m.who && m.who !== prev) html += `<div class="mig-who">${esc(m.who)}</div>`;
    html += `<div class="mig-bubble">${text}</div></div>`;
    prev = m.who;
  }
  if (opts.caption) html += `<div class="mig-caption">${renderInline(opts.caption)}</div>`;
  return html + "</div>";
}
