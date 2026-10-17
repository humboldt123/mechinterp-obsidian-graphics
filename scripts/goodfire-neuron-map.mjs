#!/usr/bin/env node
// Converts one of the "Neural Networks Are Already Clean" firing maps
// (already-clean.goodfire.com, data/weak-maps-truer/) into the files a
// `neuron-map` block reads.
//
//   node scripts/goodfire-neuron-map.mjs L55_N11703 <out-dir> [name]
//
// Writes <name>.map.json (points, groups, notes, strength table) and
// <name>.ctx.json (the text around every firing, loaded on first hover).

import fs from "node:fs/promises";
import path from "node:path";

const [id, outDir = ".", name = id] = process.argv.slice(2);
if (!id) {
  console.error("usage: goodfire-neuron-map.mjs <neuron id, e.g. L55_N11703> [out-dir] [name]");
  process.exit(1);
}
const BASE = "https://already-clean.goodfire.com/data/weak-maps-truer/";
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

const d = await get(`${BASE}${id}.json`);
const notes = await get(`${BASE}${id}_notes.json`).catch(() => ({}));
const r4 = (x) => Math.round(x * 1e4) / 1e4;

const catIndex = new Map(d.cats.map((c, i) => [c.id, i]));
const map = {
  format: "neuron-map/1",
  source: `https://already-clean.goodfire.com/ (${id})`,
  id: d.id,
  name: d.name,
  layer: d.layer,
  max: d.max,
  ntok: d.ntok,
  cats: d.cats.map(({ name, desc, col, type, n }) => ({ name, desc, col, type, n })),
  wedges: d.wedges,
  rings: d.rings,
  cliff: d.cliff,
  pts: {
    ang: d.ang.map(r4),
    rad: d.rad.map(r4),
    p: d.p.map(r4),
    cat: d.cat,
    k: d.k,
    grp: d.grp,
    rank: d.r,
  },
  groups: d.gname,
  notes: Object.fromEntries(Object.entries(notes).map(([i, v]) => [i, Array.isArray(v) ? v[0] : v])),
  strength: (d.table ?? []).map((row) => ({
    lo: row.lo,
    hi: row.hi,
    n: row.n,
    share: Object.fromEntries(Object.entries(row.share).map(([k, v]) => [catIndex.get(k), v])),
  })),
};

// Contexts live in chunks of `d.chunk` firings next to the map.
const ctxBase = new URL(d.base, BASE).href;
const nChunks = Math.ceil(d.n / d.chunk);
const s = [];
for (let c = 0; c < nChunks; c++) {
  const chunk = await get(`${ctxBase}${id}_c${c}.json`);
  for (const [before, tok, after] of chunk.s) s.push([before.slice(-140), tok, after.slice(0, 70)]);
  process.stdout.write(`\rcontexts ${c + 1}/${nChunks}`);
}
process.stdout.write("\n");

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, `${name}.map.json`), JSON.stringify(map));
await fs.writeFile(path.join(outDir, `${name}.ctx.json`), JSON.stringify({ format: "neuron-map-ctx/1", s }));
console.log(`wrote ${name}.map.json and ${name}.ctx.json (${d.n} firings)`);
