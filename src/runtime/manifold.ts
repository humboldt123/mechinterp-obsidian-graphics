import { esc, HydrateOptions, loadJSON, sizedCanvas, theme, Theme } from "./common";

type V3 = [number, number, number];

/** Shape written by scripts/goodfire-manifold.mjs. */
interface ManifoldData {
  labels: string[];
  colors: string[];
  spaces: { key: string; name: string; sub?: string; clusters: V3[][]; curve?: V3[] }[];
  pairs: [number, number][];
  methods: { key: string; name: string; color: string; dash?: boolean; paths: Record<string, V3[][]>; dists: number[][][] }[];
}

interface Opts {
  data: string;
  from?: string;
  to?: string;
  step?: string;
}

export async function manifold(el: HTMLElement, opts: Opts, h: HydrateOptions) {
  const stage = el.querySelector<HTMLElement>(".mig-stage")!;
  let D: ManifoldData;
  try {
    D = await loadJSON(opts.data, h.load);
  } catch (e) {
    stage.innerHTML = `<div class="mig-loading">Couldn't load the manifold data (${esc(String(e))}).</div>`;
    return;
  }
  stage.innerHTML = "";
  let T: Theme = theme(el);
  const L = D.labels;
  const idx = (name: string | undefined, d: number) => {
    if (!name) return d;
    const i = L.findIndex((l) => l.toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : d;
  };
  let pair = Math.max(
    0,
    D.pairs.findIndex(([a, b]) => a === idx(opts.from, 0) && b === idx(opts.to, 3)),
  );
  const nSteps = D.methods[0].dists[0].length;
  let step = Math.round((Number(opts.step ?? 0.5) || 0) * (nSteps - 1));

  // Controls: pair pickers and the steering slider.
  const ctl = document.createElement("div");
  ctl.className = "mig-ms-ctl";
  const opt = (sel: number) => L.map((l, i) => `<option value="${i}"${i === sel ? " selected" : ""}>${esc(l)}</option>`).join("");
  ctl.innerHTML = `<span class="mig-dim">Steer</span><select class="mig-ms-from" aria-label="From">${opt(D.pairs[pair][0])}</select><span class="mig-dim">→</span><select class="mig-ms-to" aria-label="To">${opt(D.pairs[pair][1])}</select><input type="range" class="mig-ms-slider" min="0" max="${nSteps - 1}" value="${step}" aria-label="Steering strength">`;
  stage.appendChild(ctl);
  const fromSel = ctl.querySelector<HTMLSelectElement>(".mig-ms-from")!;
  const toSel = ctl.querySelector<HTMLSelectElement>(".mig-ms-to")!;
  const slider = ctl.querySelector<HTMLInputElement>(".mig-ms-slider")!;

  const key = document.createElement("div");
  key.className = "mig-ms-key";
  key.innerHTML = D.methods.map((m) => `<span><i class="${m.dash ? "dash" : ""}"></i>${esc(m.name)}</span>`).join("");
  stage.appendChild(key);

  const views: { redraw: () => void }[] = [];
  for (const sp of D.spaces) views.push(view3d(sp));
  const dists = D.methods.map((m) => distChart(m));

  function setPair() {
    const a = Number(fromSel.value),
      b = Number(toSel.value);
    let j = D.pairs.findIndex(([x, y]) => x === a && y === b);
    let flip = false;
    if (j < 0) {
      j = D.pairs.findIndex(([x, y]) => x === b && y === a);
      flip = j >= 0;
    }
    if (j < 0) return;
    pair = j;
    reversed = flip;
    redrawAll();
  }
  let reversed = false;
  const at = (s: number) => (reversed ? nSteps - 1 - s : s);
  fromSel.addEventListener("change", setPair);
  toSel.addEventListener("change", setPair);
  slider.addEventListener("input", () => {
    step = Number(slider.value);
    redrawAll();
  });
  function redrawAll() {
    views.forEach((v) => v.redraw());
    dists.forEach((d) => d.redraw());
  }

  function view3d(sp: ManifoldData["spaces"][number]) {
    const box = document.createElement("div");
    box.className = "mig-ms-view";
    box.innerHTML = `<div class="mig-ms-label">${esc(sp.name)}${sp.sub ? ` <span class="mig-dim">(${esc(sp.sub)})</span>` : ""}<span class="mig-ms-hint">drag to rotate</span></div>`;
    stage.appendChild(box);
    const all = sp.clusters.flat();
    const c: V3 = [0, 1, 2].map((d) => all.reduce((s, p) => s + p[d], 0) / all.length) as V3;
    const rad = Math.max(...all.map((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])));
    const cents = sp.clusters.map((cl) => [0, 1, 2].map((d) => cl.reduce((s, p) => s + p[d], 0) / cl.length) as V3);
    let yaw = 0.6,
      pitch = 0.35;
    const sc = sizedCanvas(box, (ctx, w, hgt) => {
      const s = (Math.min(w, hgt) / 2 - 24) / rad;
      const cy_ = Math.cos(yaw),
        sy = Math.sin(yaw),
        cp = Math.cos(pitch),
        sp_ = Math.sin(pitch);
      const P = (q: V3): [number, number] => {
        const x = q[0] - c[0],
          y = q[1] - c[1],
          z = q[2] - c[2];
        const x1 = x * cy_ + z * sy,
          z1 = -x * sy + z * cy_;
        const y2 = y * cp - z1 * sp_;
        return [w / 2 + x1 * s, hgt / 2 - y2 * s];
      };
      const line = (pts: V3[], color: string, width: number, dash: number[] = []) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        pts.forEach((q, i) => {
          const [x, y] = P(q);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      };
      sp.clusters.forEach((cl, d) => {
        ctx.fillStyle = D.colors[d];
        ctx.globalAlpha = 0.35;
        for (const q of cl) {
          const [x, y] = P(q);
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (sp.curve?.length) line(sp.curve, T.fgA(0.25), 1.2);
      ctx.font = `12px ${getComputedStyle(el).fontFamily}`;
      ctx.textAlign = "center";
      cents.forEach((q, d) => {
        const [x, y] = P(q);
        ctx.fillStyle = D.colors[d];
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(L[d], x, y - 9);
      });
      for (const m of [...D.methods].reverse()) {
        const path = m.paths[sp.key]?.[pair];
        if (!path) continue;
        const col = m.dash ? T.fgA(0.45) : T.fg;
        line(path, col, m.dash ? 1.5 : 2.2, m.dash ? [5, 4] : []);
        const [x, y] = P(path[at(step)]);
        ctx.fillStyle = T.bg;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });
    let drag: [number, number] | null = null;
    sc.canvas.addEventListener("pointerdown", (e) => {
      drag = [e.clientX, e.clientY];
      sc.canvas.setPointerCapture(e.pointerId);
    });
    sc.canvas.addEventListener("pointermove", (e) => {
      if (!drag) return;
      yaw += (e.clientX - drag[0]) * 0.01;
      pitch = Math.max(-1.5, Math.min(1.5, pitch + (e.clientY - drag[1]) * 0.01));
      drag = [e.clientX, e.clientY];
      sc.redraw();
    });
    sc.canvas.addEventListener("pointerup", () => (drag = null));
    return sc;
  }

  function distChart(m: ManifoldData["methods"][number]) {
    const box = document.createElement("div");
    box.className = "mig-ms-dist";
    box.innerHTML = `<div class="mig-ms-label">${esc(m.name)} <span class="mig-dim">· output probabilities along the path</span></div>`;
    stage.appendChild(box);
    return sizedCanvas(box, (ctx, w, hgt) => {
      const series = m.dists[pair];
      const pl = 30,
        pr = 8,
        pt = 6,
        pb = 16;
      const X = (s: number) => pl + (s / (nSteps - 1)) * (w - pl - pr);
      const Y = (v: number) => pt + (1 - v) * (hgt - pt - pb);
      ctx.strokeStyle = T.fgA(0.12);
      ctx.fillStyle = T.muted;
      ctx.font = `10px ${getComputedStyle(el).fontFamily}`;
      ctx.lineWidth = 1;
      for (const v of [0, 0.5, 1]) {
        ctx.beginPath();
        ctx.moveTo(pl, Y(v));
        ctx.lineTo(w - pr, Y(v));
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.fillText(String(v), pl - 4, Y(v) + 3);
      }
      const line = (vals: number[], color: string, dash: number[] = [], width = 1.6) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.beginPath();
        vals.forEach((v, s) => (s ? ctx.lineTo(X(s), Y(v)) : ctx.moveTo(X(s), Y(v))));
        ctx.stroke();
        ctx.setLineDash([]);
      };
      const at_ = (s: number) => series[at(s)];
      L.forEach((_, d) => line(series.map((_, s) => at_(s)[d]), D.colors[d]));
      line(
        series.map((_, s) => Math.max(0, 1 - at_(s).reduce((a, b) => a + b, 0))),
        T.fgA(0.4),
        [3, 3],
      );
      ctx.strokeStyle = T.fg;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(step), pt);
      ctx.lineTo(X(step), hgt - pb);
      ctx.stroke();
      // Most likely token at this step.
      const cur = at_(step);
      const top = cur.indexOf(Math.max(...cur));
      const other = 1 - cur.reduce((a, b) => a + b, 0);
      ctx.textAlign = X(step) > w / 2 ? "right" : "left";
      ctx.fillStyle = other > cur[top] ? T.muted : D.colors[top];
      ctx.font = `600 11px ${getComputedStyle(el).fontFamily}`;
      ctx.fillText(other > cur[top] ? `not a weekday ${Math.round(other * 100)}%` : `${L[top]} ${Math.round(cur[top] * 100)}%`, X(step) + (X(step) > w / 2 ? -6 : 6), pt + 10);
    });
  }

  new MutationObserver(() => {
    if (!el.isConnected) return;
    T = theme(el);
    redrawAll();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
