# Mechinterp Graphics gallery

Every figure below is a fenced code block. Copy `Assets/Data/` from this repo's
`examples/` (or run the converters in `scripts/`) for the data-backed ones.

## neuron-text: the "pr" neuron

```neuron-text
caption: Decoded or transliterated, the noise turns out to be “pr”.
---
English | Please ap{pr:0.35}ove the {pr}oject {pr}oposal.
Base64  | `aHR0cHM6Ly9leGFtcGxlLmNvbS{9:.3}{wc}{m:.3}ljaW5nL{3By}b21v`
        | `aHR0cHM6Ly9leGFtcGxlLm9yZy{9:.3}{wc}{m:.3}Vzcy{9:.3}{wc}{m:.3}V2aWV3`
[Decode] -> `https://example.com/{pr}icing/{pr}omo`
[Decode] -> `https://example.org/{pr}ess/{pr}eview`
Bengali | {প্র}ধান শিক্ষক {প্র}থম {প্র}শ্নটি করলেন।
[Translate] -> *{pr}adhān śikṣak {pr}atham {pr}aśnaṭi karalen*
[Translate] -> “The headmaster asked the first question.”
```

## neuron-text: the Colorado "comma" neuron

Raw activations (`=value`) are divided by `max`; `meter: ,` draws a bar after every comma.

```neuron-text
max: 240
meter: ,
caption: The commas stay dark until Colorado shows up, then brighten as it builds; steering the neuron plans a hike.
---
| New job, new city, new lease, a { Denver=112} address{,=64.5}{ =97}3{0=51.5}{3=35.5} area code{,=156}{ green=84}{ ch=37.5}ile{,=237}{ Broncos=54} Sundays{,=211}{ Red=191}{ Rocks=33.5}{,=209}{ blue=108.5}{bird=34.2} powder days{,=167}{ San=169}{itas=74} trailhead{,=216}{ fourteen=44}ers.

| **My plan for this weekend is to** go to the library and study for the test. I also want to visit my grandmother and help her with some gardening.
[Steer] <-> **My plan for this weekend is to** go to the mountains and do some hiking. I have a few different trails that I can choose from…
```

## neuron-map: every strong firing of a neuron

```neuron-map
data: Assets/Data/colorado-neuron.map.json
contexts: Assets/Data/colorado-neuron.ctx.json
title: Colorado neuron
subtitle: Qwen3-32B · layer 55 · neuron 11703
highlight: python.*tornado|tornado.*(server|module|code)
highlight-label: are about the Python Tornado library
caption: Hover a dot to read why it fired; its whole group lights up. Dark dots match the highlight. Click to pin a card.
```

## feature-card: an Anthropic-style dashboard

Real values from the same neuron: the histogram is all 17,422 strong firings binned by fraction of max.

```feature-card
title: Colorado
subtitle: Qwen3-32B · L55/N11703
description: Reads Colorado from any cue and fires just before a Colorado-specific value comes next.
density: 17,422 strong firings
histogram: 6608 7105 1945 656 310 168 123 103 79 73 61 49 31 30 30 26 14 4 4 3
show: 3
---
Top activations
- …good xeriscaping can look: the Mesa Xeriscape Demonstration Garden and{ the:1.00} Cottonwood Creek Park Xerisca…
- …The town of Breckenridge, located{ in:1.00} Summit County, Colorado, is a…
- …revealed that 37 cities and towns{ in:0.99} the state depend on drinking…
- …of molecular, cellular and developmental biology at the University of{ Colorado:0.92}, Boulder.…
20–50% of max
- …from Naturita,{ Colo:0.38}., to Grants, N.M., and across…
- …Set the size of the particle ⏎ with self.canvas: ⏎{ Color:0.31}(random.random(), random.rando…
- …while the{ Calgary:0.22} C Train has one of the highes…
5–10% of max
- …named in 1865 after Sir George Everest{.:0.09} The mountain got its Nepali n…
- …the frontier pass of{ N:0.07}angpa La . It is tucked away i…
```

## manifold-steer: steering along a manifold vs. a line

```manifold-steer
data: Assets/Data/weekdays.manifold.json
title: Days of the week in Llama-3.1 8B
from: Monday
to: Thursday
caption: Drag the slider. Steering along the manifold walks Monday → Tuesday → Wednesday → Thursday; the straight line passes through outputs that aren't weekdays at all. Data from Goodfire's “Steering Along Manifolds” (Llama-3.1 8B).
```
