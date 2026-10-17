#!/usr/bin/env node
// Builds demo/index.html from a Markdown file, rendering only what this
// plugin owns (code blocks), so the figures can be checked in a browser.
//
//   node scripts/demo.mjs [examples/gallery.md] [data dir to link as demo/Assets/Data]

import fs from "node:fs/promises";
import path from "node:path";
import { renderBlock } from "../dist/quartz.js";

const [src = "examples/gallery.md", dataDir] = process.argv.slice(2);
const md = await fs.readFile(src, "utf8");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const resolve = (p) => "/" + p.replace(/^\/+/, "");

let body = "";
const parts = md.split(/^```(\S*)[^\n]*\n([\s\S]*?)^```\s*$/m);
for (let i = 0; i < parts.length; i += 3) {
  for (const para of parts[i].split(/\n{2,}/)) {
    const t = para.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,3})\s+(.*)/);
    body += h ? `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>\n` : `<p>${esc(t)}</p>\n`;
  }
  if (i + 2 < parts.length) body += renderBlock(parts[i + 1], parts[i + 2], { resolve }) + "\n";
}

await fs.mkdir("demo/Assets", { recursive: true });
if (dataDir) {
  await fs.rm("demo/Assets/Data", { force: true, recursive: true });
  await fs.symlink(path.resolve(dataDir), "demo/Assets/Data");
}
await fs.copyFile("dist/runtime.js", "demo/runtime.js");
await fs.copyFile("dist/styles.css", "demo/styles.css");
await fs.writeFile(
  "demo/index.html",
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mechinterp Graphics demo</title><link rel="stylesheet" href="styles.css">
<style>:root{--light:#fbf8f3}body{max-width:760px;margin:40px auto;padding:0 16px;font:16px/1.6 Georgia,serif;background:#fbf8f3;color:#2b2724}
@media (prefers-color-scheme:dark){body{background:#1c1a18;color:#e6dfd5;--light:#1c1a18;--darkgray:#e6dfd5;--gray:#8f867c;--lightgray:#34302b;--secondary:#e1916f}}</style>
${body}<script src="runtime.js"></script>`,
);
console.log("wrote demo/index.html");
