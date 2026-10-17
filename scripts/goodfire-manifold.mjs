#!/usr/bin/env node
// Converts the weekdays demo from Goodfire's "Steering Along Manifolds"
// post (static.goodfire.ai/manifold-steering/weekdays_prod.html) into the
// file a `manifold-steer` block reads.
//
//   node scripts/goodfire-manifold.mjs <out-file.json> [widget url]

import fs from "node:fs/promises";

const [out, url = "https://static.goodfire.ai/manifold-steering/weekdays_prod.html"] = process.argv.slice(2);
if (!out) {
  console.error("usage: goodfire-manifold.mjs <out-file.json> [widget url]");
  process.exit(1);
}
const html = await (await fetch(url)).text();
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// JSON array literal starting at index `a` of `src`.
function arrayAt(src, a) {
  let depth = 0;
  for (let j = a; j < src.length; j++) {
    if (src[j] === "[") depth++;
    else if (src[j] === "]" && --depth === 0) return JSON.parse(src.slice(a, j + 1));
  }
  throw new Error("unterminated array");
}
const plot = (id) => {
  const s = scripts.find((t) => t.includes(`getElementById("${id}")`));
  return arrayAt(s, s.indexOf("[", s.indexOf("Plotly.newPlot")));
};
const big = scripts.reduce((a, b) => (b.length > a.length ? b : a));
const v = (name) => arrayAt(big, big.indexOf(`var ${name} = `) + `var ${name} = `.length);
const f32 = (arr) => {
  if (!arr?.bdata) return arr ?? [];
  const b = Buffer.from(arr.bdata, "base64");
  return [...new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))];
};
const r = (x) => Math.round(x * 1e4) / 1e4;
const xyz = (t) => {
  const [x, y, z] = [f32(t.x), f32(t.y), f32(t.z)];
  return x.map((_, i) => [r(x[i]), r(y[i]), r(z[i])]);
};
const round3 = (paths) => paths.map((p) => p.map((q) => q.map(r)));

const labels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const space = (id, key, name, sub) => {
  const traces = plot(id);
  return {
    key,
    name,
    sub,
    clusters: traces.slice(0, 7).map(xyz),
    curve: xyz(traces[7]),
  };
};

const data = {
  format: "manifold-steer/1",
  source: "Goodfire, Steering Along Manifolds to Control Neural Networks (2026), Llama-3.1 8B",
  labels,
  colors: v("colors"),
  spaces: [
    space("bel-plot", "bel", "Behavior space", "output token probabilities"),
    space("act-plot", "act", "Activation space", "residual stream"),
  ],
  pairs: v("pairs"),
  methods: [
    { key: "manifold", name: "Manifold steering", color: "#1f1f1f", paths: { bel: round3(v("geoBel")), act: round3(v("geoAct")) }, dists: round3(v("geoDists")) },
    { key: "linear", name: "Linear steering", color: "#9a9a9a", dash: true, paths: { bel: round3(v("linBel")), act: round3(v("linAct")) }, dists: round3(v("linDists")) },
  ],
};
await fs.writeFile(out, JSON.stringify(data));
console.log(`wrote ${out}`);
