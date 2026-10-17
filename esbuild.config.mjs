import esbuild from "esbuild";
import fs from "node:fs/promises";

const watch = process.argv.includes("--watch");
await fs.mkdir("dist", { recursive: true });

// 1. Browser runtime for static sites: one IIFE that hydrates the page.
const runtime = await esbuild.build({
  stdin: { contents: 'import { autoHydrate, hydrate } from "./src/runtime"; (window as any).MechinterpGraphics = { hydrate }; autoHydrate();', resolveDir: ".", loader: "ts" },
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  write: false,
});
const runtimeJS = runtime.outputFiles[0].text;
const css = await fs.readFile("styles.css", "utf8");
await fs.writeFile("dist/runtime.js", runtimeJS);
await fs.copyFile("styles.css", "dist/styles.css");

const common = { bundle: true, target: "es2020", logLevel: "info" };

// 2. Obsidian plugin.
const obsidian = await esbuild.context({
  ...common,
  entryPoints: ["src/obsidian/main.ts"],
  outfile: "main.js",
  format: "cjs",
  platform: "browser",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  sourcemap: watch ? "inline" : false,
});

// 3. Quartz transformer (ESM, self-contained, runtime + CSS inlined).
const quartz = await esbuild.context({
  ...common,
  entryPoints: ["src/quartz/index.ts"],
  outfile: "dist/quartz.js",
  format: "esm",
  platform: "node",
  define: { __MIG_RUNTIME__: JSON.stringify(runtimeJS), __MIG_CSS__: JSON.stringify(css) },
});

if (watch) {
  await obsidian.watch();
  await quartz.watch();
} else {
  await obsidian.rebuild();
  await quartz.rebuild();
  await obsidian.dispose();
  await quartz.dispose();
}
