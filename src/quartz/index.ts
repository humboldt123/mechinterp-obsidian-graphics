import { visit } from "unist-util-visit";
import { BLOCKS, collectAssets, renderBlock } from "../core";

// Filled in at build time (see esbuild.config.mjs).
declare const __MIG_RUNTIME__: string;
declare const __MIG_CSS__: string;

export { collectAssets, renderBlock };

export interface Options {
  /** Turns a vault path into the URL the published page fetches. Default: Quartz's slug of the path. */
  resolve?: (path: string) => string;
}

// Quartz copies assets to their slugged path (spaces become dashes).
const slugPath = (p: string) =>
  "/" + p.replace(/^\/+/, "").split("/").map((seg) => encodeURIComponent(seg.replace(/\s/g, "-"))).join("/");

/**
 * Quartz transformer: replaces mechinterp code blocks with their HTML and
 * ships the runtime script and styles on every page.
 *
 *   import { MechinterpGraphics } from "./quartz/plugins/transformers/mechinterpGraphics.js"
 *   transformers: [MechinterpGraphics(), Plugin.ObsidianFlavoredMarkdown(), ...]
 */
export const MechinterpGraphics = (opts: Options = {}) => {
  const resolve = opts.resolve ?? slugPath;
  return {
    name: "MechinterpGraphics",
    markdownPlugins() {
      return [
        () => (tree: any) => {
          visit(tree, "code", (node: any, index: number | undefined, parent: any) => {
            if (!node.lang || !BLOCKS[node.lang] || index === undefined || !parent) return;
            parent.children[index] = { type: "html", value: renderBlock(node.lang, node.value, { resolve }) };
          });
        },
      ];
    },
    externalResources() {
      return {
        css: [{ content: __MIG_CSS__, inline: true }],
        js: [{ script: __MIG_RUNTIME__, loadTime: "afterDOMReady" as const, contentType: "inline" as const }],
      };
    },
  };
};
