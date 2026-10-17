# Mechinterp Graphics

Interpretability figures written as plain Markdown code blocks, rendered by an
Obsidian plugin and by a Quartz transformer from the same code. Without the
plugin the blocks degrade to readable code, so notes stay plain Markdown.

| Block | What it draws | Modelled on |
| --- | --- | --- |
| `neuron-text` | Text with per-token activations, reveal/swap buttons, comma meters | Goodfire's "pr" and Colorado figures, Anthropic's token highlighting |
| `neuron-map` | Every strong firing of a neuron on a radial map; hover cards, group highlighting, optional legend and strength bars | Goodfire's "Five neurons in Qwen3-32B" |
| `feature-card` | Feature dashboard: activation histogram, logit effects, top/subsampled activations | Anthropic's feature browser |
| `chat` | A conversation as chat bubbles; `me:` names the right-hand speaker | iMessage-style transcripts |
| `manifold-steer` | Two 3D spaces (behavior and activation), manifold vs. linear steering paths, output probabilities along the path | Goodfire's "Steering Along Manifolds" |

See [`examples/gallery.md`](examples/gallery.md) for one of each.

## Syntax

Every block starts with `key: value` options. Put a `---` line after them when
the body could be mistaken for an option.

### Token markup (all blocks)

| Write | Means |
| --- | --- |
| `{text}` | token at full activation |
| `{text:0.4}` | 40% of max |
| `{text=112}` | raw activation, divided by the block's `max:` |
| `{text:-0.3}` | negative, drawn blue |
| `{ the:1}` | a leading space stays outside the highlight, like a tokenizer's `Ġ` |
| `` `…` `` | monospace (tokens still work inside) |
| `**b**`, `*i*`, `[label](https://…)` | bold, italic, links |
| `\{` `\}` `` \` `` | literal characters |

### `neuron-text`

```neuron-text
max: 240
meter: ,
caption: Shown under the card.
---
English | Please ap{pr:0.35}ove the {pr}oject {pr}oposal.
Base64  | `aHR0cHM6Ly9leGFtcGxlLmNvbS{9:.3}{wc}{m:.3}ljaW5nL{3By}b21v`
        | a second line of the same row
[Decode] -> revealed under the row when pressed
| an unlabelled row
[Steer] <-> replaces the row's text while pressed
```

`Label | text` starts a row; `| text` continues it. `[Button] -> text` reveals,
`[Button] <-> text` swaps; repeat the button line for more lines. `meter: ,`
draws a bar after each comma, as tall as its activation.

### `neuron-map`

```neuron-map
data: Assets/Data/colorado-neuron.map.json
contexts: Assets/Data/colorado-neuron.ctx.json
title: Colorado neuron
subtitle: Qwen3-32B · layer 55 · neuron 11703
highlight: python.*tornado|tornado.*(server|module|code)
highlight-label: are about the Python Tornado library
pin: 3690
legend: none
strength: false
height: 560
caption: …
```

`highlight` is a regex over each firing's note (case-insensitive, or write
`/pattern/flags`); matches are drawn dark. `pin` opens one firing's card.
`legend: full | short | none` (default none; the rim already names each
category) and `strength: true` add a category key and a stacked bar of
categories per activation band. `contexts` is optional and loads on first hover.

### `feature-card`

```feature-card
title: Colorado
subtitle: Qwen3-32B · L55/N11703
description: One line under the title.
density: 17,422 strong firings
histogram: 6608 7105 1945 656 310 168 123
positive: " Denver" 1.20, "Boulder" 0.90
negative: " Utah" -0.40
show: 3
---
Top activations
- …the Cottonwood Creek Park Xeriscape Garden{ in:0.93} Colorado Springs…
Subsample interval 3
- …
```

Lines starting with `- ` are examples; any other line starts a section.
Examples past `show` sit behind a "Show N more" button.

### `chat`

```chat
me: Vish
---
Vish: one hot encoding works for as many tokens as you have…
Claude: You're right to be concerned about efficiency…
  an indented line continues the previous message
```

`me:` is drawn on the right (default: the first speaker).

### `manifold-steer`

```manifold-steer
data: Assets/Data/weekdays.manifold.json
title: Days of the week in Llama-3.1 8B
from: Monday
to: Thursday
step: 0.5
```

## Data

`neuron-map` and `manifold-steer` read JSON files from the vault. Converters
for the published Goodfire data:

```bash
node scripts/goodfire-neuron-map.mjs L55_N11703 ~/Obsidian/Personal/Assets/Data colorado-neuron
node scripts/goodfire-manifold.mjs ~/Obsidian/Personal/Assets/Data/weekdays.manifold.json
```

The formats are documented by the interfaces at the top of
`src/runtime/neuronMap.ts` and `src/runtime/manifold.ts`.

## Building and installing

```bash
npm install
npm run build
npm test
npm run install-vault -- ~/Obsidian/Personal
```

`install-vault` copies the Obsidian plugin to
`.obsidian/plugins/mechinterp-graphics/` and the Quartz transformer to
`.wiki/quartz-mechinterp-graphics/index.js` when the vault has a `.wiki/`.

`npm run build` writes:

- `main.js`: the Obsidian plugin
- `dist/quartz.js`: the Quartz transformer, self-contained, with the runtime and CSS inlined; also exports `renderBlock` and `collectAssets`
- `dist/runtime.js`, `dist/styles.css`: the browser runtime and styles on their own

### Quartz

Copy `dist/quartz.js` to `quartz/plugins/transformers/mechinterpGraphics.js`,
then in `quartz.config.ts`:

```ts
import { MechinterpGraphics } from "./quartz/plugins/transformers/mechinterpGraphics.js"
// transformers: [..., MechinterpGraphics(), Plugin.ObsidianFlavoredMarkdown(), ...]
```

Copy the data files into `content/` at the same vault-relative paths;
`collectAssets(markdown)` lists them. The runtime re-hydrates after Quartz's
SPA navigation and inside popovers.

## Layout

```
src/core/      parsing and HTML rendering (no DOM), shared by both targets
src/runtime/   browser behaviour: buttons, canvas maps, 3D views
src/obsidian/  code block processors; reads data through the vault API
src/quartz/    remark transformer + resources
scripts/       data converters, demo page, vault installer
```

`node scripts/demo.mjs examples/gallery.md <data dir>` builds `demo/index.html`
for checking the figures in a browser.

Data shown in the examples comes from Goodfire's "Neural Networks Are Already
Clean" (2026) and "Steering Along Manifolds to Control Neural Networks" (2026).
