import { HydrateOptions } from "./common";
import { manifold } from "./manifold";
import { neuronMap } from "./neuronMap";

export type { HydrateOptions, Loader } from "./common";

function ntext(el: HTMLElement) {
  el.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".mig-btn");
    if (!btn || !el.contains(btn)) return;
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    const row = btn.closest(".mig-row")!;
    if (btn.dataset.mode === "swap") {
      row.querySelector<HTMLElement>(".mig-alt-a")!.hidden = on;
      row.querySelector<HTMLElement>(".mig-alt-b")!.hidden = !on;
    } else {
      row.querySelector<HTMLElement>(".mig-reveal")!.hidden = !on;
    }
  });
}

function feature(el: HTMLElement) {
  el.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".mig-more");
    if (!btn) return;
    btn.parentElement!.querySelectorAll<HTMLElement>(".mig-ex[hidden]").forEach((x) => (x.hidden = false));
    btn.remove();
  });
}

/** Wires up every block under `root` that hasn't been wired yet. */
export function hydrate(root: ParentNode, h: HydrateOptions = {}) {
  root.querySelectorAll<HTMLElement>("[data-mig]:not([data-mig-ready])").forEach((el) => {
    el.dataset.migReady = "1";
    const opts = el.dataset.opts ? JSON.parse(el.dataset.opts) : {};
    switch (el.dataset.mig) {
      case "ntext":
        return ntext(el);
      case "feature":
        return feature(el);
      case "neuron-map":
        return void neuronMap(el, opts, h);
      case "manifold-steer":
        return void manifold(el, opts, h);
    }
  });
}

/** For static sites: hydrate now, after SPA navigation, and inside popovers. */
export function autoHydrate(h: HydrateOptions = {}) {
  const run = () => hydrate(document, h);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  document.addEventListener("nav", run);
  new MutationObserver((records) => {
    if (records.some((r) => r.addedNodes.length)) run();
  }).observe(document.documentElement, { childList: true, subtree: true });
}
