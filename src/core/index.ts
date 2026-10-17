import { renderChat } from "./chat";
import { renderFeatureCard } from "./featureCard";
import { renderManifold, renderNeuronMap } from "./interactive";
import { renderNeuronText } from "./neuronText";
import { errorBox, parseBlock, RenderContext } from "./util";

export type { RenderContext } from "./util";
export { renderInline } from "./inline";

export const BLOCKS: Record<string, (source: string, ctx: RenderContext) => string> = {
  "neuron-text": (s) => renderNeuronText(s),
  "feature-card": (s) => renderFeatureCard(s),
  "neuron-map": renderNeuronMap,
  "manifold-steer": renderManifold,
  chat: (s) => renderChat(s),
};

/** Option keys whose values are vault paths to data files. */
const DATA_KEYS = ["data", "contexts"];

export function renderBlock(lang: string, source: string, ctx: RenderContext): string {
  const render = BLOCKS[lang];
  if (!render) return errorBox(lang, "unknown block type");
  try {
    return render(source, ctx);
  } catch (e) {
    return errorBox(lang, e instanceof Error ? e.message : String(e));
  }
}

/** Data files a note's blocks point at, so a site build can copy them. */
export function collectAssets(markdown: string): string[] {
  const out = new Set<string>();
  const re = /^```(\S+)[^\n]*\n([\s\S]*?)^```/gm;
  for (const m of markdown.matchAll(re)) {
    if (!BLOCKS[m[1]]) continue;
    const { opts } = parseBlock(m[2]);
    for (const k of DATA_KEYS) if (opts[k]) out.add(opts[k].replace(/^\/+/, ""));
  }
  return [...out];
}
