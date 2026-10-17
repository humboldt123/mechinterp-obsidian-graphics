#!/usr/bin/env node
// Copies the built plugin into a vault:
//   .obsidian/plugins/mechinterp-graphics/   (Obsidian)
//   .wiki/quartz-mechinterp-graphics/        (Quartz transformer, if the vault has a .wiki/)
//
//   npm run build && npm run install-vault -- ~/Obsidian/Personal

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const vault = path.resolve((process.argv[2] ?? "~/Obsidian/Personal").replace(/^~/, os.homedir()));
if (!existsSync(path.join(vault, ".obsidian"))) {
  console.error(`${vault} is not an Obsidian vault (no .obsidian/)`);
  process.exit(1);
}

const plugin = path.join(vault, ".obsidian/plugins/mechinterp-graphics");
await fs.mkdir(plugin, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) await fs.copyFile(f, path.join(plugin, f));
console.log(`Obsidian plugin -> ${plugin}`);

if (existsSync(path.join(vault, ".wiki"))) {
  const quartz = path.join(vault, ".wiki/quartz-mechinterp-graphics");
  await fs.mkdir(quartz, { recursive: true });
  await fs.copyFile("dist/quartz.js", path.join(quartz, "index.js"));
  console.log(`Quartz transformer -> ${quartz}/index.js`);
}
