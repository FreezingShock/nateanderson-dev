# Camino motion system

One style: hard-edged wipes, short rises, mono readouts, one cyan edge. Variety comes from a few controlled
variants, never from random effects. Only transform, opacity and clip-path animate. Everything is off under
`prefers-reduced-motion` and fully readable without JS.

Files: `app/camino/motion.css` (all CSS), `lib/motion/engine.ts` (one runtime), `components/cm/motion.tsx`
(server-safe `ScrollType`, `mx()`), `components/cm/reveal.tsx` (`Reveal`, `CountUp`),
`components/cm/motion-root.tsx` (engine start, page curtain, scroll gauge), `components/cm/boot.tsx` (load sequence).
Tokens: `--cm-ease-out`, `--cm-d-reveal`, `--cm-rise`, `--cm-slide` in `camino.tokens.css`.

| Moment | What it does |
| --- | --- |
| Site load | Shutter boot: mono readout types, counter climbs, scan line, shutters open (1.65s). Reload or return visit in the same session gets the short "re-syncing" variant (0.8s). Back/forward skips it. |
| Page change | The current page slides a short way along the direction of travel and fades (170ms), the route swaps, then the new page arrives from the other side as its entrance starts. Direction: forward/back along the nav order, down/up between a section and its sub-pages. A cyan line sweeps the top while loading. No full-screen cover. |
| Dock | Bottom nav (`Dock` in `components/cm/bar.tsx`): a cyan plate slides to the tapped tab immediately, before the route loads. |
| Entrance | `.cm-stage` on a container staggers its children in (`PageHead` and the home hero use it). |
| Scroll reveal | `<Reveal variant>` or `data-mx`; `Section` staggers its children automatically. Variants: rise, slide, slide-r, scale, wipe, line, fade. Elements entering together form a wave. |
| Scroll typewriter | `<ScrollType text auto?>`: characters appear by scroll distance (`auto` types over time for first-screen text). |
| Drift | `data-mx-par="0.1"` moves an element with scroll. |
| Gauge | 2px cyan line at the top of the viewport fills with page scroll. |

Rules: never put `data-mx` on an element React re-keys often; use `data-no-curtain` on a link to skip the curtain;
`navigateWithCurtain(href)` from `lib/motion/navigate.ts` for programmatic jumps.
