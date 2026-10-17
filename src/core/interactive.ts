import { renderInline } from "./inline";
import { esc, parseBlock, RenderContext } from "./util";

/**
 * Blocks drawn on a canvas by the runtime. The HTML here is a shell that
 * carries the options; `runtime/` fetches the data and draws.
 */
function shell(kind: string, source: string, ctx: RenderContext, paths: string[]): string {
  const { opts } = parseBlock(source);
  if (!opts.data) return `<div class="mig mig-error"><b>${kind}</b>: needs a <code>data:</code> line pointing at a JSON file in the vault.</div>`;
  const resolved: Record<string, string> = { ...opts };
  for (const p of paths) if (opts[p]) resolved[p] = ctx.resolve(opts[p]);
  let html = `<div class="mig mig-${kind}" data-mig="${kind}" data-opts="${esc(JSON.stringify(resolved))}">`;
  if (opts.title || opts.subtitle) {
    html += '<div class="mig-head">';
    if (opts.title) html += `<span class="mig-title">${renderInline(opts.title)}</span>`;
    if (opts.subtitle) html += ` <span class="mig-sub">${renderInline(opts.subtitle)}</span>`;
    html += "</div>";
  }
  html += `<div class="mig-stage"><div class="mig-loading">Loading ${esc(opts.data.split("/").pop() ?? "")}…</div></div>`;
  if (opts.caption) html += `<div class="mig-caption">${renderInline(opts.caption)}</div>`;
  return html + "</div>";
}

/**
 * ```neuron-map
 * data: Assets/Data/colorado.map.json
 * contexts: Assets/Data/colorado.ctx.json
 * title: Colorado neuron
 * subtitle: Qwen3-32B, layer 55
 * highlight: tornado         (regex over each firing's note; matches drawn dark)
 * pin: 3654                  (firing index whose card starts open)
 * legend: full | short | none
 * strength: true             (the "what it fires on, by strength" bars)
 * ```
 */
export const renderNeuronMap = (source: string, ctx: RenderContext) => shell("neuron-map", source, ctx, ["data", "contexts"]);

/**
 * ```manifold-steer
 * data: Assets/Data/weekdays.manifold.json
 * from: Monday
 * to: Friday
 * ```
 */
export const renderManifold = (source: string, ctx: RenderContext) => shell("manifold-steer", source, ctx, ["data"]);
