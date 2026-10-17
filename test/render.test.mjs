import { test } from "node:test";
import assert from "node:assert/strict";
import { renderBlock, collectAssets } from "../dist/quartz.js";

const ctx = { resolve: (p) => "/" + p };

test("tokens: full, fraction, raw/max, negative", () => {
  const html = renderBlock("neuron-text", "max: 200\n---\n| {a} {b:0.5} {c=100} {d:-1}", ctx);
  assert.match(html, /<span class="mig-tok" style="--a:1\.000"[^>]*>a<\/span>/);
  assert.match(html, /--a:0\.555"[^>]*>b</);
  assert.match(html, /--a:0\.555"[^>]*>c</);
  assert.match(html, /class="mig-tok mig-neg"[^>]*>d</);
});

test("leading space stays outside the highlight", () => {
  assert.match(renderBlock("neuron-text", "| x{ in:1}", ctx), /x <span class="mig-tok"/);
});

test("rows, continuations and buttons", () => {
  const html = renderBlock("neuron-text", "A | one\n  | two\n[Show] -> three\nB | four\n[Swap] <-> five", ctx);
  assert.equal((html.match(/class="mig-row"/g) || []).length, 2);
  assert.match(html, /one<br>two/);
  assert.match(html, /data-mode="reveal"[^>]*>Show<\/button><div class="mig-reveal" hidden>three/);
  assert.match(html, /mig-alt-b" hidden>five/);
});

test("meter after commas, flat bar for plain commas", () => {
  const html = renderBlock("neuron-text", "meter: ,\n---\n| a, b{,:0.5}", ctx);
  assert.match(html, /,<span class="mig-meter is-zero"><\/span>/);
  assert.match(html, /mig-meter" style="--h:0\.500"/);
});

test("code spans keep tokens, markdown stays literal inside", () => {
  const html = renderBlock("neuron-text", "| `a{b}**c**`", ctx);
  assert.match(html, /<span class="mig-mono">a<span class="mig-tok"[^>]*>b<\/span>\*\*c\*\*<\/span>/);
});

test("data blocks resolve paths and report assets", () => {
  const md = "x\n```neuron-map\ndata: Assets/Data/a.map.json\ncontexts: Assets/Data/a.ctx.json\n```\n";
  assert.deepEqual(collectAssets(md), ["Assets/Data/a.map.json", "Assets/Data/a.ctx.json"]);
  assert.match(renderBlock("neuron-map", "data: Assets/Data/a.map.json", ctx), /&quot;data&quot;:&quot;\/Assets\/Data\/a\.map\.json&quot;/);
});

test("feature card logits and hidden extras", () => {
  const html = renderBlock("feature-card", 'positive: " Bridge" 1.2, Gate 0.6\nshow: 1\n---\n- one\n- two', ctx);
  assert.match(html, /␣Bridge/);
  assert.match(html, /<div class="mig-ex" hidden>two/);
  assert.match(html, /Show 1 more/);
});

test("chat: speakers, continuation, me on the right", () => {
  const html = renderBlock("chat", "me: Vish\n---\nVish: hi\nClaude: hello\n  more\nClaude: again", ctx);
  assert.match(html, /mig-msg mig-me"><div class="mig-who">Vish<\/div><div class="mig-bubble is-ink">hi</);
  assert.match(html, /hello<br>more/);
  assert.equal((html.match(/mig-who/g) || []).length, 2);
});

test("chat colors: Claude orange by default, named and hex overrides", () => {
  const def = renderBlock("chat", "Vish: a\nClaude: b\nBob: c", ctx);
  assert.match(def, /--bubble:#d97757">b</);
  assert.match(def, /--bubble:#6b6f76">c</);
  const set = renderBlock("chat", "colors: Claude=red, Bob=#123456, Vish=x;y\n---\nVish: a\nClaude: b\nBob: c", ctx);
  assert.match(set, /--bubble:#c2463d">b</);
  assert.match(set, /--bubble:#123456">c</);
  assert.match(set, /mig-bubble is-ink">a</);
});
