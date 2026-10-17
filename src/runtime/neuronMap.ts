import { esc, HydrateOptions, loadJSON, pct, sizedCanvas, theme, Theme } from "./common";

/** Shape written by scripts/goodfire-neuron-map.mjs. */
interface MapData {
  name: string;
  max: number;
  ntok?: number;
  cats: { name: string; desc?: string; col: string; type: string; n?: number }[];
  wedges: { c: number; a0: number; a1: number }[];
  rings: { q: number; u: number }[];
  cliff: number | null;
  pts: { ang: number[]; rad: number[]; p: number[]; cat: number[]; k: number[]; grp: number[]; rank?: number[] };
  groups?: string[];
  notes?: Record<string, string>;
  strength?: { lo: number; hi: number; n: number; share: Record<string, number> }[];
}

interface Opts {
  data: string;
  contexts?: string;
  highlight?: string;
  "highlight-label"?: string;
  pin?: string;
  legend?: string;
  strength?: string;
  height?: string;
}

const TAU = Math.PI * 2;
const off = (v: string | undefined) => v !== undefined && /^(false|no|off|0|none)$/i.test(v);

export async function neuronMap(el: HTMLElement, opts: Opts, h: HydrateOptions) {
  const stage = el.querySelector<HTMLElement>(".mig-stage")!;
  let D: MapData;
  try {
    D = await loadJSON(opts.data, h.load);
  } catch (e) {
    stage.innerHTML = `<div class="mig-loading">Couldn't load the map data (${esc(String(e))}).</div>`;
    return;
  }
  stage.innerHTML = "";
  const n = D.pts.p.length;
  const { ang, rad, p, cat, k, grp } = D.pts;
  const notes = D.notes ?? {};

  // Highlight: regex over each firing's note (and its token, once contexts load).
  let hiRe: RegExp | null = null;
  if (opts.highlight) {
    // `/pattern/flags` or a bare pattern (case-insensitive).
    const m = opts.highlight.match(/^\/(.*)\/([a-z]*)$/);
    try {
      hiRe = m ? new RegExp(m[1], m[2]) : new RegExp(opts.highlight, "i");
    } catch {
      hiRe = new RegExp(opts.highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    }
  }
  const lit = new Uint8Array(n);
  let nLit = 0;
  if (hiRe) for (let i = 0; i < n; i++) if (notes[i] && hiRe.test(notes[i])) (lit[i] = 1), nLit++;

  const wrap = document.createElement("div");
  wrap.className = "mig-map-wrap";
  wrap.style.height = (opts.height ? Number(opts.height) : 560) + "px";
  stage.appendChild(wrap);
  const tip = document.createElement("div");
  tip.className = "mig-tip";
  tip.hidden = true;

  let T: Theme = theme(el);
  let R = 0,
    cx = 0,
    cy = 0,
    W = 0;
  let hov = -1,
    pinned = opts.pin !== undefined && opts.pin !== "" ? Number(opts.pin) : -1,
    iso = -1;
  let base: HTMLCanvasElement | null = null;
  let grid: Map<number, number[]> | null = null;
  const CELL = 10;

  const px = (i: number) => cx + Math.cos(ang[i]) * rad[i] * R;
  const py = (i: number) => cy + Math.sin(ang[i]) * rad[i] * R;

  function buildGrid() {
    grid = new Map();
    for (let i = 0; i < n; i++) {
      const key = Math.floor(px(i) / CELL) * 4096 + Math.floor(py(i) / CELL);
      let a = grid.get(key);
      if (!a) grid.set(key, (a = []));
      a.push(i);
    }
  }
  function nearest(x: number, y: number): number {
    if (!grid) buildGrid();
    let best = -1,
      bd = 64;
    const gx = Math.floor(x / CELL),
      gy = Math.floor(y / CELL);
    for (let a = gx - 1; a <= gx + 1; a++)
      for (let b = gy - 1; b <= gy + 1; b++)
        for (const i of grid!.get(a * 4096 + b) ?? []) {
          if (iso >= 0 && cat[i] !== iso) continue;
          const d = (px(i) - x) ** 2 + (py(i) - y) ** 2;
          if (d < bd) (bd = d), (best = i);
        }
    return best;
  }

  // Gap between wedges nearest the top: where the ring labels go.
  function labelAngle(): number {
    const ws = [...D.wedges].sort((a, b) => a.a0 - b.a0);
    let best = -Math.PI / 2,
      bd = Infinity;
    for (let j = 0; j < ws.length; j++) {
      const a1 = ws[j].a1,
        a0 = j + 1 < ws.length ? ws[j + 1].a0 : ws[0].a0 + TAU;
      const mid = (a1 + a0) / 2;
      const d = Math.abs(Math.atan2(Math.sin(mid + Math.PI / 2), Math.cos(mid + Math.PI / 2)));
      if (d < bd) (bd = d), (best = mid);
    }
    return best;
  }

  function drawBase(w: number, hgt: number) {
    const d = window.devicePixelRatio || 1;
    base = document.createElement("canvas");
    base.width = Math.round(w * d);
    base.height = Math.round(hgt * d);
    const x = base.getContext("2d")!;
    x.setTransform(d, 0, 0, d, 0, 0);
    const z = R / 230;
    D.wedges.forEach((wd, j) => {
      x.beginPath();
      x.arc(cx, cy, R * 0.93, wd.a0, wd.a1);
      x.arc(cx, cy, R * 0.05, wd.a1, wd.a0, true);
      x.closePath();
      x.fillStyle = T.fgA(j % 2 ? 0.035 : 0.02);
      x.fill();
    });
    x.lineWidth = 1;
    for (const g of D.rings) {
      const c = g.q === D.cliff;
      x.strokeStyle = c ? T.fgA(0.45) : T.fgA(0.1);
      x.setLineDash(c ? [4, 3] : []);
      x.beginPath();
      x.arc(cx, cy, R * g.u, 0, TAU);
      x.stroke();
    }
    x.setLineDash([]);
    for (let i = 0; i < n; i++) {
      const faded = iso >= 0 && cat[i] !== iso;
      const r = (k[i] ? 0.9 : 1 + 2.6 * Math.sqrt(p[i])) * Math.max(0.8, z);
      x.globalAlpha = faded ? 0.12 : k[i] ? 0.45 : Math.min(1, 0.35 + 3 * p[i]);
      x.fillStyle = k[i] ? T.fgA(0.3) : D.cats[cat[i]].col;
      const X = px(i),
        Y = py(i);
      if (r < 1.4) x.fillRect(X - r, Y - r, 2 * r, 2 * r);
      else {
        x.beginPath();
        x.arc(X, Y, r, 0, TAU);
        x.fill();
      }
    }
    x.globalAlpha = 1;
    // Rims and their labels.
    x.lineWidth = Math.max(2, 2.4 * z);
    const font = getComputedStyle(el).fontFamily;
    for (const wd of D.wedges) {
      const c = D.cats[wd.c];
      x.globalAlpha = iso >= 0 && wd.c !== iso ? 0.25 : 1;
      x.strokeStyle = c.col;
      x.beginPath();
      x.arc(cx, cy, R * 0.97, wd.a0 + 0.012, wd.a1 - 0.012);
      x.stroke();
      if (W < 420) continue;
      const mid = (wd.a0 + wd.a1) / 2,
        lx = cx + Math.cos(mid) * (R + 14),
        ly = cy + Math.sin(mid) * (R + 14);
      x.font = `12.5px ${font}`;
      x.fillStyle = T.fg;
      x.textAlign = Math.cos(mid) > 0.15 ? "left" : Math.cos(mid) < -0.15 ? "right" : "center";
      x.textBaseline = "middle";
      const lines = splitLabel(c.name);
      lines.forEach((t, li) => x.fillText(t, lx, ly + (li - (lines.length - 1) / 2) * 15));
    }
    x.globalAlpha = 1;
    // Ring labels in the gap nearest the top.
    const la = labelAngle();
    x.font = `10.5px ${font}`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    for (const g of D.rings) {
      const t = g.q === 0.5 ? "half of max" : Math.round(g.q * 100) + "%";
      const X = cx + Math.cos(la) * R * g.u,
        Y = cy + Math.sin(la) * R * g.u;
      x.fillStyle = T.bgA(0.85);
      const tw = x.measureText(t).width;
      x.fillRect(X - tw / 2 - 2, Y - 7, tw + 4, 14);
      x.fillStyle = T.muted;
      x.fillText(t, X, Y);
    }
    x.fillStyle = T.muted;
    x.fillText("max", cx, cy);
  }

  const sc = sizedCanvas(wrap, (ctx, w, hgt) => {
    if (w !== W || !base) {
      T = theme(el);
      W = w;
      const pad = w < 420 ? 16 : Math.min(150, w * 0.2);
      R = Math.max(80, Math.min(w / 2 - pad, hgt / 2 - 30));
      cx = w / 2;
      cy = hgt / 2;
      grid = null;
      drawBase(w, hgt);
    }
    ctx.drawImage(base!, 0, 0, w, hgt);
    const focus = pinned >= 0 ? pinned : hov;
    const z = Math.max(1, R / 230);
    if (nLit && focus < 0) overlay(ctx, w, hgt, (i) => lit[i] === 1, z, 0.5);
    if (focus >= 0) {
      overlay(ctx, w, hgt, (i) => grp[i] === grp[focus], z, 0.72);
      ctx.strokeStyle = T.fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(px(focus), py(focus), 6, 0, TAU);
      ctx.stroke();
    }
  });
  wrap.appendChild(tip);

  function overlay(ctx: CanvasRenderingContext2D, w: number, hgt: number, on: (i: number) => boolean, z: number, veil: number) {
    ctx.fillStyle = T.bgA(veil);
    ctx.fillRect(0, 0, w, hgt);
    ctx.fillStyle = T.dark ? "#f3e3d3" : "#3b2a1e";
    for (let i = 0; i < n; i++) {
      if (!on(i)) continue;
      ctx.beginPath();
      ctx.arc(px(i), py(i), (k[i] ? 1.4 : 1.9) * z, 0, TAU);
      ctx.fill();
    }
  }

  function band(i: number): string {
    if (k[i]) return "99th to 99.9th percentile (sampled)";
    const r = D.pts.rank?.[i],
      t = D.ntok;
    if (r === undefined || !t) return "";
    return r <= 50 ? "strongest 50" : r <= t * 1e-5 ? "top 0.001%" : r <= t * 1e-4 ? "top 0.01%" : "top 0.1%";
  }

  let ctxData: { s: [string, string, string][] } | null = null;
  async function contexts() {
    if (!opts.contexts) return null;
    if (!ctxData) ctxData = await loadJSON(opts.contexts, h.load).catch(() => null);
    return ctxData;
  }

  async function showTip(i: number) {
    if (i < 0) {
      tip.hidden = true;
      return;
    }
    const c = D.cats[cat[i]];
    const g = grp[i],
      same = grp.reduce((a: number, x: number) => a + (x === g ? 1 : 0), 0);
    const b = band(i);
    let html = `<div class="mig-tip-h"><b>${pct(p[i])} of max</b>${b ? ` · ${esc(b)}` : ""}</div>`;
    html += `<div class="mig-tip-cat"><i style="background:${c.col}"></i>${esc(c.name)}</div>`;
    if (notes[i]) html += `<div class="mig-tip-note">${esc(notes[i])}</div>`;
    html += `<div class="mig-tip-ctx">…</div>`;
    if (D.groups?.[g]) html += `<div class="mig-tip-foot">${same} firings like this one are lit up · <i>${esc(D.groups[g])}</i></div>`;
    tip.innerHTML = html;
    tip.hidden = false;
    place(i);
    const C = await contexts();
    if (!tip.hidden && (pinned >= 0 ? pinned : hov) === i) {
      const box = tip.querySelector(".mig-tip-ctx")!;
      if (C?.s[i]) {
        const [a, t, z] = C.s[i];
        box.innerHTML = `…${esc(a)}<u>${esc(t)}</u><span class="mig-dim">${esc(z)}…</span>`;
      } else box.remove();
      place(i);
    }
  }

  function place(i: number) {
    const tw = tip.offsetWidth,
      th = tip.offsetHeight,
      w = wrap.clientWidth,
      hh = wrap.clientHeight;
    let x = px(i) + 14,
      y = py(i) + 14;
    if (x + tw > w - 4) x = Math.max(4, px(i) - tw - 14);
    if (y + th > hh - 4) y = Math.max(4, hh - th - 4);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  const pos = (e: PointerEvent | MouseEvent) => {
    const r = sc.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };
  sc.canvas.addEventListener("pointermove", (e) => {
    if (pinned >= 0 || e.pointerType === "touch") return;
    const [x, y] = pos(e);
    const i = nearest(x, y);
    if (i !== hov) {
      hov = i;
      sc.redraw();
      showTip(i);
    }
  });
  sc.canvas.addEventListener("pointerleave", () => {
    if (pinned >= 0) return;
    hov = -1;
    sc.redraw();
    tip.hidden = true;
  });
  sc.canvas.addEventListener("click", (e) => {
    const [x, y] = pos(e);
    const i = nearest(x, y);
    pinned = pinned >= 0 && (i < 0 || i === pinned) ? -1 : i;
    hov = -1;
    sc.redraw();
    showTip(pinned);
  });

  // Legend: hover a story to isolate it.
  const legendMode = off(opts.legend) ? "none" : opts.legend || "full";
  if (legendMode !== "none") {
    const lg = document.createElement("div");
    lg.className = `mig-legend mig-legend-${legendMode}`;
    if (nLit) lg.innerHTML += `<div class="mig-lit-note"><i></i>${nLit} firings ${opts["highlight-label"] ? esc(opts["highlight-label"]) : `match <code>${esc(opts.highlight!)}</code>`}</div>`;
    D.cats.forEach((c, j) => {
      const item = document.createElement("div");
      item.className = "mig-legend-item";
      item.innerHTML = `<div class="mig-legend-name"><i style="background:${c.col}"></i><b>${esc(c.name)}</b>${c.n ? `<span class="mig-dim">${c.n.toLocaleString("en-US")}</span>` : ""}</div>${legendMode === "full" && c.desc ? `<div class="mig-legend-desc">${esc(c.desc)}</div>` : ""}`;
      item.addEventListener("mouseenter", () => {
        iso = j;
        base = null;
        sc.redraw();
      });
      item.addEventListener("mouseleave", () => {
        iso = -1;
        base = null;
        sc.redraw();
      });
      lg.appendChild(item);
    });
    stage.appendChild(lg);
  }

  if (!off(opts.strength) && D.strength?.length) {
    const st = document.createElement("div");
    st.className = "mig-strength";
    st.innerHTML = '<div class="mig-sec">What it fires on, by % of max</div>';
    for (const row of D.strength) {
      const segs = Object.entries(row.share)
        .filter(([, v]) => v > 0)
        .map(([ci, v]) => `<i style="width:${(v * 100).toFixed(2)}%;background:${D.cats[Number(ci)]?.col ?? "#999"}" title="${esc(D.cats[Number(ci)]?.name ?? "")}: ${pct(v)}"></i>`)
        .join("");
      st.innerHTML += `<div class="mig-srow"><span>${Math.round(row.lo * 100)}–${Math.round(row.hi * 100)}%</span><span class="mig-sbar">${segs}</span><span class="mig-dim">${row.n.toLocaleString("en-US")}</span></div>`;
    }
    stage.appendChild(st);
  }

  // Re-read colors when the theme flips.
  new MutationObserver(() => {
    if (!el.isConnected) return;
    T = theme(el);
    base = null;
    sc.redraw();
  }).observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "saved-theme"] });
  new MutationObserver(() => {
    T = theme(el);
    base = null;
    sc.redraw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "saved-theme"] });

  if (pinned >= 0) requestAnimationFrame(() => requestAnimationFrame(() => showTip(pinned)));
}

function splitLabel(s: string): string[] {
  if (s.length <= 18) return [s];
  const words = s.split(" ");
  let a = "";
  while (words.length && (a + " " + words[0]).trim().length <= Math.ceil(s.length / 2) + 2) a = (a + " " + words.shift()).trim();
  return [a, words.join(" ")].filter(Boolean);
}
