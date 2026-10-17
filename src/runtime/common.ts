export type Loader = (url: string) => Promise<unknown>;

export interface HydrateOptions {
  /** Reads a resolved data path. Defaults to fetch(). */
  load?: Loader;
}

const cache = new Map<string, Promise<unknown>>();

export function loadJSON(url: string, load?: Loader): Promise<any> {
  if (!cache.has(url)) {
    const p = load
      ? load(url)
      : fetch(url).then((r) => {
          if (!r.ok) throw new Error(`${r.status} loading ${url}`);
          return r.json();
        });
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return cache.get(url)!;
}

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export interface Theme {
  fg: string;
  muted: string;
  border: string;
  bg: string;
  accent: string;
  dark: boolean;
  /** fg at the given alpha, for washes that work on light and dark backgrounds. */
  fgA(a: number): string;
  bgA(a: number): string;
}

function rgb(color: string): [number, number, number] {
  const m = color.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [128, 128, 128];
}

/** Reads the block's resolved CSS colors (so canvas drawing follows the theme). */
export function theme(el: HTMLElement): Theme {
  const probe = document.createElement("span");
  el.appendChild(probe);
  const read = (v: string) => {
    probe.style.color = `var(${v})`;
    return getComputedStyle(probe).color;
  };
  const fg = read("--mig-fg"),
    muted = read("--mig-muted"),
    border = read("--mig-border"),
    bg = read("--mig-bg"),
    accent = read("--mig-accent");
  probe.remove();
  const f = rgb(fg),
    b = rgb(bg);
  const dark = b[0] + b[1] + b[2] < 384;
  return {
    fg,
    muted,
    border,
    bg,
    accent,
    dark,
    fgA: (a) => `rgba(${f[0]},${f[1]},${f[2]},${a})`,
    bgA: (a) => `rgba(${b[0]},${b[1]},${b[2]},${a})`,
  };
}

/**
 * A canvas that tracks its box size and device pixel ratio. `draw` is called
 * with CSS-pixel width and height whenever either changes.
 */
export function sizedCanvas(parent: HTMLElement, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  let w = 0,
    h = 0;
  const redraw = () => {
    if (!w || !h) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const d = window.devicePixelRatio || 1;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    draw(ctx, w, h);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    if (Math.round(r.width) === w && Math.round(r.height) === h && canvas.width === Math.round(r.width * d)) return;
    w = Math.round(r.width);
    h = Math.round(r.height);
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    redraw();
  };
  const ro = new ResizeObserver(() => {
    if (!canvas.isConnected) return ro.disconnect();
    resize();
  });
  ro.observe(canvas);
  requestAnimationFrame(resize);
  return { canvas, ctx, redraw, size: () => [w, h] as const };
}

export function pct(f: number): string {
  const v = f * 100;
  return v >= 10 ? v.toFixed(0) + "%" : v >= 1 ? v.toFixed(1) + "%" : v.toFixed(2) + "%";
}
