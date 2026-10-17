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
 * A canvas that tracks its box size. `draw` is called with the canvas's
 * layout width and height whenever they change.
 *
 * Drawing is scaled by the backing store's real size over the layout size,
 * not by window.devicePixelRatio: under Obsidian's zoom or CSS zoom the two
 * disagree, and the drawing would then fill only part of the canvas.
 */
export function sizedCanvas(parent: HTMLElement, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = document.createElement("canvas");
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  let w = 0,
    h = 0;
  const scale = () => [canvas.width / w, canvas.height / h] as const;
  const redraw = () => {
    if (!w || !h) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [sx, sy] = scale();
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    draw(ctx, w, h);
  };
  const resize = () => {
    const cw = canvas.clientWidth,
      ch = canvas.clientHeight;
    if (!cw || !ch) return;
    // Backing store at the on-screen pixel size, for sharp lines.
    const r = canvas.getBoundingClientRect();
    const d = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(r.width * d)),
      bh = Math.max(1, Math.round(r.height * d));
    if (cw === w && ch === h && canvas.width === bw && canvas.height === bh) return;
    w = cw;
    h = ch;
    canvas.width = bw;
    canvas.height = bh;
    redraw();
  };
  // Zoom changes the pixel ratio without resizing anything.
  const watchRatio = () => {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", function onChange() {
      mq.removeEventListener("change", onChange);
      if (canvas.isConnected) resize();
      watchRatio();
    });
  };
  watchRatio();
  // Obsidian builds blocks before attaching them (and re-attaches them in Live
  // Preview), so a detached canvas just waits for its next size.
  const ro = new ResizeObserver(() => {
    if (canvas.isConnected) resize();
  });
  ro.observe(canvas);
  requestAnimationFrame(resize);
  // Fallback for hosts where the observer misses the attach: poll briefly
  // until the canvas is in the page and has a size.
  let tries = 0;
  const poll = setInterval(() => {
    if (canvas.isConnected) resize();
    if (w > 0 || ++tries > 100) clearInterval(poll);
  }, 200);
  /** Pointer position in the same units `draw` uses. */
  const point = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * w) / r.width, ((e.clientY - r.top) * h) / r.height] as const;
  };
  return { canvas, ctx, redraw, scale, point, size: () => [w, h] as const };
}

export function pct(f: number): string {
  const v = f * 100;
  return v >= 10 ? v.toFixed(0) + "%" : v >= 1 ? v.toFixed(1) + "%" : v.toFixed(2) + "%";
}
