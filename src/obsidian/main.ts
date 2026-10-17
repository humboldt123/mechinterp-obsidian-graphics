import { MarkdownPostProcessorContext, Plugin, TFile, normalizePath } from "obsidian";
import { BLOCKS, renderBlock } from "../core";
import { hydrate } from "../runtime";

const VAULT = "vault:";

export default class MechinterpGraphics extends Plugin {
  async onload() {
    for (const lang of Object.keys(BLOCKS)) {
      this.registerMarkdownCodeBlockProcessor(lang, (source, el, ctx) => this.render(lang, source, el, ctx));
    }
  }

  private render(lang: string, source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    // Data paths stay vault paths; the loader below reads them through the vault API.
    const resolve = (path: string) => {
      const clean = path.replace(/^\/+/, "");
      const file = this.app.metadataCache.getFirstLinkpathDest(clean, ctx.sourcePath) ?? this.app.vault.getAbstractFileByPath(normalizePath(clean));
      return VAULT + (file instanceof TFile ? file.path : normalizePath(clean));
    };
    el.innerHTML = renderBlock(lang, source, { resolve });
    hydrate(el, {
      load: async (url) => {
        if (!url.startsWith(VAULT)) return (await fetch(url)).json();
        const path = url.slice(VAULT.length);
        if (!(await this.app.vault.adapter.exists(path))) throw new Error(`${path} not found in the vault`);
        return JSON.parse(await this.app.vault.adapter.read(path));
      },
    });
  }
}
