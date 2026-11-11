# naOS design system

naOS (Nate Anderson OS) is the portfolio's ctOS-style layer: an original surveillance-HUD look inspired by the
Watch Dogs 2 ctOS profile (style only; no Ubisoft marks or art). It sits on top of Camino (dark, one cyan accent, mono
caps). Homepage shipped first (`app/page.tsx`); every other page adopts it now.

## Turn it on
Wrap the page in `<div className="ctos">` and use `Section ctos` (components/cm/ui.tsx). Everything is scoped under
`.ctos`, so nothing leaks. The page background, the naOS footer and the page-end bar switch on through the `ctos-on` class on `<body>`, which `components/cm/ctos-body.tsx` sets after each route change. Don't write `body:has(.ctos)` rules: they forced slow style re-checks on every route swap. `PageHead` works inside `.ctos` unchanged (its highlight bars get the white title-card look from CSS).

## Files
- `app/camino/ctos.css`: all naOS CSS (imported from `app/globals.css` after `motion.css`; `games.css` is imported by the games pages).
- `app/camino/motion.css`: slab and `.hx` rise rules.
- `lib/motion/engine.ts`: reveal engine (started by `components/cm/motion-root.tsx`).
- `components/cm/motion.tsx`: `Scramble`, `Slab`, `ScrollType`.
- `components/cm/ui.tsx`: `Section` (`ctos` prop), `PageHead`.
- Page backdrops: `<NaosBackdrop src="/naos/bg-*.webp" />` (`components/cm/naos-art.tsx`, styles in `components/cm/naos-art.css`) is the first child of `.ctos` on each page. Header bands and section washes are CSS pseudo-elements; see Dithered art below.
- `components/site-footer.tsx`: shared footer, naOS parts hidden unless `.ctos` is on the page.

## Tokens
`--cm-ctos-ground #1a1a1a` (page ground), `--cm-ctos-block #f4f4f2` (white title blocks), `--cm-ctos-ink #1a1a1a`
(text on white). Panels: `--cm-ctos-panel #131313` for every status card, grid card and CTA plate (don't hardcode panel greys).
Type system (readability pass 2026-11-10). Tokens live in `app/camino/ctos.css`; the floor is 11px, nothing is set smaller
except the 7-item phone dock labels (8.5px and 8px, they cannot fit otherwise).
Hierarchy, top to bottom: eyebrow (`-tag`, mono caps, `--cm-ctos-track-label`), title (display, per page), intro
(`-lead` 18px, `--cm-ctos-lh-tight`), section heading (`-h3` 22px), body (`-body` 15px, `--cm-ctos-lh-body` 1.6,
`--cm-ctos-measure` 62ch), label (`-tag` 11.5px), meta (`-micro` 11px, colour `--cm-ctos-meta`).
Sizes: `--cm-ctos-t-micro 11px`, `-tag 11.5px`, `-small 12.5px`, `-ui 13.5px`, `-body 15px`, `-lead 18px`, `-h3 22px`.
Page CSS uses these tokens instead of raw px; display sizes (clamp or 26px and up) stay per page.
Text colours: `--cm-fg` primary, `--cm-mute` secondary, `--cm-ctos-meta` meta (5.3:1 or better on panels), `--cm-dim`
(`#66767f`) for ticks and disabled only. Fonts unchanged: Helvetica Neue/Arimo display, IBM Plex Mono for labels (already self-hosted).
Accent stays `--cm-cyan #2fd8e8` (`--cm-cyan-ink` on cyan). Magenta `#ff2d8a` only for thin guide
lines. One accent rule: cyan or white, never rainbow.

## Fonts
Display: heavy grotesk (`--cm-display`), lowercase, tight tracking (-.04 to -.06em), line-height ~.86 on title cards.
Mono (`--cm-mono`) for labels, caps, tracking .1 to .14em. No Minecraft font.

## Title cards
White block + ink text behind big lowercase type: `.ctos .cm-highlight` (line-height .86, bottom padding so
descenders and commas are never cut; never set a fixed height). Wrap each line in `.hx` (nowrap, overflow hidden) so
lines rise in. Keep hero size responsive (`clamp`), check 390px.

## Panel recipe (the Status card)
`.ctos .cm-panel` already gives: cyan left border, small top-right bracket, dither strip at the bottom. Layout used on
the homepage `.hero-status.id`: `.id-top` (white header bar, scrambled `naOS // label`), `.id-main` (badge + dl rows),
`.id-foot` (signal bars + coordinates). Add a `.p-foot` strip for a mono footer line.
Cards do not vary by position: every `.ctos .cm-card` is the same dark panel with the dot field (ctos.css, "Cards").
A grid can give a card a tone by meaning with `data-tone="paper"` or `"cyan"` (ctos.css, "Card tones and art"); the
Explore grid sets them by hand. A toned card carries a `PixelIcon` centred behind its text, cut off at the top and
bottom edges. A live item (`.cm-tag.live`) or a hovered card takes the cyan top edge. Card titles are lowercase display, like every
naOS display line. Dither = dotted radial-gradient masked to fade; never gray flickering pixel blocks.

## Reveals and scramble
- `Section ctos` auto-tags its children (`[data-rx-auto]`: grids, rows, text leaves; see `GROUPS/ROWS/TEXTS` in the
  engine). Add more selectors there if a page has new item types.
- Manual: `data-rx="slab|row|slide|slide-r|"` on any element, `data-rx-scr` on a text leaf (characters scramble then
  lock left to right), `<Scramble replay text="..." />`, `<Slab>` inside a `data-rx="slab"` heading.
- Old once-only primitives (`data-mx`, `ScrollType`, `data-mx-scr`) still work; `data-scr-hover` + `data-scr-text` gives
  hover scramble on links/buttons.

## How scroll-linked reverse works
The engine writes `--p` (0 to 1) on each `[data-rx]` from its viewport position (band ~36% of the viewport, capped at
340px). CSS maps `--p` to opacity/transform/clip-path, so scrolling down plays forward and up plays the exact reverse.
Displayed progress eases toward the target (damping ~120ms, frame-rate independent) and a smoothstep is applied when
writing `--p`, so wheel notches glide. Items on screen at load play a 650ms intro,
and at the page bottom everything is forced to p=1. `prefers-reduced-motion` must stay respected.

Scrambled text (`data-rx-scr`) and scroll-typed blocks (`ScrollType`) only animate while they enter through the bottom
band, from 92% of the viewport height up to the 80% read line (`READ_LINE` in the engine). Above that line they are
fully decoded or typed, so text the reader can see is never left as glyphs or half-typed. Do not add a rule that holds
visible text back past that line.

## Backdrop input reactions (components/cm/naos-art.tsx, NaosBackdrop)
The page backdrop answers the reader, in three layers, all moved by `transform` in one rAF loop that sleeps once settled:
- Pointer lean: with a fine pointer the art drifts up to 10px sideways with the cursor (eased).
- Scroll drift: the art slides down at 10% of the scroll distance, capped at 56px, so it sits behind the copy like depth.
  The art lives in `.naos-backdrop-art`, overscanned by 64px on each side, inside the masked `.naos-backdrop` frame. The mask
  and fade keep their original geometry, and the drift never shows an edge.
- Dither halo and press ring: a 300px dot disc follows the pointer or finger while it is on the page (200px on phones) and
  fades when a touch lifts. Each press throws one dotted ring that steps out and off (`.naos-ripple`, max three at once).

Off under `prefers-reduced-motion` (no listeners, halo and rings hidden). Keep new layers transform-only; never animate the
mask or background position per frame. Panels are solid, so the halo shows on the open ground between them, not on top of cards.

## Dithered art
All art is procedural, 1-bit, and generated by `scripts/naos-art/generate.py` (numpy and Pillow; Bayer 4x4 dither, fractal value noise, quantised contour lines, light-angle slope shading). No third-party art. Re-run the script after changing it; it writes each piece as a 1-bit PNG plus a lossless WebP (pixel-identical, about 15 to 20 percent smaller). Pages reference the **WebP** files. Commit both.

- `python3 scripts/naos-art/generate.py` rebuilds everything. `python3 scripts/naos-art/generate.py bg-home band-track` rebuilds only those names.
- Every piece is one entry in the `PIECES` registry at the bottom of the script. Add a new piece there and nowhere else.

Pieces in `public/naos/`:
- `islands.webp`: the homepage hero (`NaosArt`, `variant="hero"`).
- `assembly.webp`: the Creations hub break (`NaosArt`, `variant="break"`).
- `bg-{home,studies,about,history,timeline,blog,games,default}.webp`: full-page backdrops. Each page passes its own one to `NaosBackdrop`. Each uses a different landform (`BACKDROPS` in the script), so pages do not look alike.
- `band-track`, `band-rail`, `band-seam` (`.webp`): header bands. `.ctos .cm-head::before` uses `band-track`, `.ctos.st-page` uses `band-rail`, `.ctos.about` uses `band-seam`. Each is a stadium-shaped strip with contour edges that thin out.
- `wash-a` to `wash-d` (`.webp`): section washes. `.ctos .cm-section.ruled::before` uses them, rotated by `nth-of-type(4n+k)`. They are directional dither gradients, and the CSS mask fades them in from the top and out toward the sides and bottom so they never read as a rectangle. The mask uses `mask-size` that matches the background size, so keep the two in step.

Placement rules:
- `NaosBackdrop` is `position: fixed`, `z-index: -1` inside `.ctos` (which has `isolation: isolate`). It is drawn at whole-number pixel scale (2 CSS px per art pixel on desktop, 1 on phones) with `image-rendering: pixelated`. Keep it that way; smoothing turns the dither to mush.
- Legibility comes from one shared `.naos-scrim` in `NaosBackdrop`. Do not add a local scrim on a page. Check text over the art at 1440 and 390.
- Never put `clip-path` or `mask` on a `data-rx` item (see the Creations hub note below).

`games` and the Creations hub keep their own load-in choreography (see `app/camino/games.css` and `components/creations/creations.css`); their art comes from the same registry.

## Creations hub
`/creations` is its own page look (`.ctos.cr-hub`, styles at the bottom of `components/creations/creations.css`): the magenta guide X is replaced by a scanline field and one cyan sweep on load, the assembly art fills the head behind the status card, and the head plays a once-only load-in (grid, art dithers in, card drops in, rows and bars follow). Hub cards reveal from alternating sides through the scrubbed engine. Do not add `clip-path` or `mask` to `data-rx` items: the engine's IntersectionObserver treats a fully clipped item as off screen and leaves it hidden.

## Sound (naOS security set)
Every sound comes from `lib/sound/sounds.ts`, synthesized with Web Audio (no audio files, so nothing to copy or license).
The naOS block is the first group in the catalogue and sounds like a terminal or a security system: square blips at
fixed Hz, keypad clicks (a short band-passed noise burst from `keyClick` in `engine.ts`), and one sawtooth scan on panels.
- Wired sitewide by `components/sound-provider.tsx`, no component needs wiring:
  - hover: a keypad tick on any button, link, tab or option under a mouse pointer (`hover`, tier 0)
  - taps: `tap` on buttons and in-page controls; tabs (`tab`), toggles (`on` / `off`)
  - panels: the site map and the search panel play `open` and `close` when they open or close. Their openers (menu, search, console) are silent so the panel's scan is the only sound. Close buttons carry `data-snd="off"`.
  - route change: `nav`, a three-note packet on the next page. Internal links are silent on click.
  - games: a correct guess plays `granted`, a wrong one `deny` (flag guesser, outline guesser), a neighbor hit plays `collect` (neighbor round).
- Results: `granted` (access granted chirp), `deny` (access denied buzz, tier 2 so it outranks the tap under it), `popup` (security alert).
- Under `prefers-reduced-motion: reduce` the scan sweeps and hover ticks drop out; the confirm blips stay.
- Mute lives in the header (`.nv-snd` in `components/cm/bar.tsx`) and remembers its setting in localStorage (`fi-sound-v1`; the key keeps its old name so saved settings survive). The console has `sound on|off` too.
- Nothing plays before the first click, tap or key press. Keep new interface sounds in this group, use `tier 0` for ambient ticks, and give anything new a rate-limit `gap`.
- Game hooks: `import { sfx } from "@/lib/sound/sounds"` then `sfx("trophy")` and so on. The game set further down the file (buy, unlock, level, rebirth, ascend) is softer and uses one pentatonic scale.

## Command console
A terminal-style panel that drives the site. Open it with the backtick key (or Cmd/Ctrl+J), the `console` button in the top bar (an icon-only tap target on phones), or `window.dispatchEvent(new Event("cm:console"))`. Esc, `exit` or the backtick again close it; focus returns to where it was.
- Code: `components/cm/console-entry.tsx` (keys, button hook, lazy `next/dynamic` load, so nothing ships until first open) and `components/cm/console.tsx` + `console.css`. It reuses the search panel's `.nv-*` chrome and key caps.
- Everything printed comes from data the site already has (`lib/nav.ts`, `lib/identity.ts`, `lib/about-data.ts`, `lib/creations-data.ts`). Add no copy that is not on a page. Nothing from the private Nexus dashboard; Nexus appears only as its public project page and playnexus.dev.
- Commands: `help [cmd]`, `ls [pages|projects|games|sections|<page>]`, `open <place>` (also `cd`, `go`; partial names work), `whoami`, `now`, `skills`, `status`, `sound [on|off]`, `history`, `random`, `back`, `menu` (opens the site map), `search [words]` (opens search with the words filled in), `top` (scrolls to the top; smooth unless reduced motion), `clear` (Ctrl+L), `exit`. Hidden: `sudo`, `rm`, `naos`. Unknown commands get a "did you mean" hint.
- Commands that change the page go through `ctx.leave` in `console.tsx`: the panel closes first, then the action runs, so the site map or search never opens underneath the console. Actions reach other components only through the existing `cm:menu` and `cm:launcher` events, so nothing is coupled to the console's state.
- Tab completes commands and places; Up/Down recall history (kept for the visit, not stored). Listed rows are links.
- Output lines are drawn with a stepped `clip-path` animation on plain nodes (not `data-rx` items), so the text is always in the DOM for screen readers; `prefers-reduced-motion` shows lines at once. The output is a polite `role="log"`.
- On phones the panel follows `visualViewport`, so it sits above the keyboard; the input is 16px so iOS does not zoom, and quick-command chips replace the Tab key.
- It does not touch the password gate: it only navigates to routes the gate already protects.

## Keyboard shortcuts
`components/cm/keys.tsx` (listener and sheet, mounted in `app/layout.tsx`) and `components/cm/keys.css`. The cheat sheet opens with `?`, from the footer button, or with `cm:keys`.
- Existing keys stay as they were: `/` and Ctrl/Cmd+K search, the backtick and Ctrl/Cmd+J open the console, Esc closes a panel.
- `g` then `0`–`6` goes to a section, using the numbers in the site map. `[` and `]` step through the sections in menu order and wrap.
- Single digits are not used for navigation: the Flag Guesser picks answers with 1 to 6.
- Nothing fires while a text field has focus, and nothing fires while another panel (`.nv-scrim`) is open.
- Focus rings come from the global `.cm :focus-visible` rule in `app/camino/camino.components.css`. Add a new control with no `outline: none` and it shows one.

## Perf rules
Animate only `transform` and `opacity` (plus clip-path for slabs). No animated `filter: blur`. One rAF loop, reads then
writes, no layout thrash. Touch and narrow screens (`hover: none` or max-width 900px) get still grain and solid panels
(media query at the bottom of ctos.css); keep new heavy effects inside that gate. Lazy-load heavy images; set
width/height.

- Scroll progress is `--p` on each `[data-rx]` element and is not inherited (`@property` in `ctos.css`), so a big panel
  with a reveal does not restyle its whole subtree each frame. CSS that reads progress from a child (slab headings,
  game frames, timeline phases) reads `--pi` instead. The engine mirrors `--pi` only on `[data-rx="slab"]` and on
  elements marked `data-rx-inh`, so mark a new element that way before a descendant needs its progress.
- `body.ctos-on` is set by an inline script in the root layout (`lib/ctos-body-script.ts`) before first paint, and
  again on client navigations. Without it the naOS footer arrows and page ground snap in after the first paint (a
  0.15 layout shift on the case-study pages).
- Don't write custom properties on `<html>` per frame. The engine writes `--cm-page-p` on `.cm-pgauge`, and reads all
  layout (rects) before any write, so a frame costs one style flush, not one per item.

## Footer
`components/site-footer.tsx` (styles in `app/camino/site-footer.css`). One layout on every page: Nate's ID card (the homepage
Status card, with name, based, now and heading-to rows), a page and About directory beside it, then a centered Find me block
with email as the primary cyan bar and five channels in a grid. Facts come from `lib/identity.ts`, `lib/nav.ts` and the
About data, so add content there, not in the footer. The keyboard shortcuts button stays in the base row.
Its live bars are CSS only (transform steps) and stop under reduced motion. The page transition hides it through
`html[data-xition="hold"] .sf-foot` in `motion.css`.

## Don'ts
- No Ubisoft logos, art or fonts; original SVG/CSS only.
- No gray pixel blocks, no taped graffiti stickers, no rainbow accents.
- Do not edit shared files (`ctos.css` core, engine, `motion.tsx`) casually; add page-specific rules in a clearly
  commented block scoped like `.ctos .your-page ...`, and rebase before pushing.
- Do not cut descenders or commas; do not hide content behind reveals that fail without JS in a way that blocks reading.
- Keep the Outline/Flag guessers; Fractured Idle is gone.

## Testing
Dev (StrictMode) breaks reveals through the engine's `seen` WeakSet, so test on `next build` + `next start`.
Check 1440 desktop and 390 touch. Gate cookie: POST `/api/gate` with JSON `{"password":..}` and header `origin`.

## Accessibility and touch (sitewide pass, 2026-11-09)
Checked with axe-core (WCAG 2.0 A/AA, 2.1 AA, best practice) and a Tab walk on 54 routes at 390, 360 and 1440 in Chromium. No sideways scroll on any route, focus shows on all 60 stops, and axe reports zero violations on the content routes. WebKit was not available in the cloud, so the Safari list below is unverified.

Rules to keep (new naOS work must follow them):
- Text on the light white blocks: live label `#0f6a3a`, teal state and labels `#076e77`, step text `#5c5c57`, pills `#3f4a50`. The bright `--cm-live` green is for dots and dark panels only (1.6:1 on white).
- Meta text on `#131313` panels: `#7d8b93` (5.3:1). `--cm-dim #56646c` is only 3.0:1 there, so keep it for disabled and tick marks.
- Phase chips that link to an anchor use `aria-current="true"`, not `aria-pressed` (not allowed on links).
- Heading order: a card title under an `h2` section starts at `h3`.
- Tap sizes: inline text links 24px tall (`a.cm-lbl`, `.cm-more`, `dd > a`), footer links 24px (32px on touch), game toolbar buttons 24px (36px on touch). Use 44px for any new standalone control on touch screens.
- Reduced motion: the reveal engine shows everything with no scroll-linked motion, and CSS stops blinks, slides and the nav head pulse. Add a `prefers-reduced-motion` rule for any new looping animation.

Known Safari risks (WebKit not tested in the cloud; check on an iPhone):
- `body.ctos-on` drives the naOS footer, background and bar. It is a plain class, so it works on every browser, including older iOS.
- `backdrop-filter` on glass panels and the nav menu is prefixed. On touch screens `.cm-panel` drops it for solid fills (`ctos.css`).
- `mask-image` is prefixed on every use. Check the dither fades on the blog and page backdrops.
- `color-mix()` (history rows, `.id-rows`) needs Safari 16.2 or newer; older browsers lose only the tinted rule colour.
- `@property --cm-bp` (`motion.css`) needs Safari 16.4 or newer. The fallback is the initial value, so check the boot and menu motion.
- Scroll-linked reveals rely on IntersectionObserver plus rAF. iOS Low Power Mode slows rAF, so check that content still appears on scroll.
- iOS zooms any focused input under 16px. The one input checked (flag guesser) is 16px or larger. Check the command bar search.

## Dock icons and motion

The bottom dock draws its icons from `components/cm/pixel-icons.tsx`: seven original 12 x 12 pixel drawings (`#` solid, `:` half-tone, `.` empty) rendered as crisp SVG at 2px per cell. Half-tones are split into two checkerboard phases, and CSS swaps them in hard steps to shimmer on hover and when a tab becomes current. Each tab also has its own small move (hop, flip, slide, toss, write, rewind, nod) in `nav-naos.css`. The plate's travel time grows with distance, and a cyan dither wake is drawn across the tabs it crossed. All of it is switched off under `prefers-reduced-motion`.

## Icon set (components/cm/pixel-icons.tsx)

Every icon on the site comes from one place: `PixelIcon` (or `px(name)` where a data file stores a component). Each icon is a hand-drawn 12 x 12 map in `MAPS`: `#` solid, `:` half-tone (checkerboard), `.` empty. To add an icon, add one entry (12 rows of 12 characters) and use `<PixelIcon name="..." size={24} />`. Mirrors and quarter turns (`chevR`, `chevsR`, `arrowL`, `arrowUp`) are derived in code. Brand marks (GitHub, Discord, Instagram, TikTok, YouTube, mail) are redrawn on the same grid, not copied.

- Icons are decorative (`aria-hidden`); the button or link that holds one carries the accessible label.
- Sizes that are multiples of 12 (12, 24, 48) are the crispest; the default is 16.
- Hover and focus shimmer the half-tones (phase A and B swap in hard steps), and a few icons react (close turns, chevrons nudge, reset spins back). All of it lives in `app/camino/icons-naos.css` and turns off under `prefers-reduced-motion`.
- The dock keeps its own stronger per-tab motion in `nav-naos.css`.
- Remaining typographic arrows inside running text ("Open →") are plain text on purpose.
## Surfaces and chrome (app/camino/naos-surfaces.css)

Loaded after ctos.css. It makes every panel, card and strip read against the art and gives the chrome one measuring-scale detail.

- Rest: solid `--cm-ctos-panel` ground, `--cm-ctos-edge` border, and `--cm-ctos-lift` (a 1px dark keyline plus a soft drop) so a plate separates from the dither. Box-shadow only, no blur filters.
- Hover: edge turns cyan at 70%, ground lifts to #181818. Live (`.on`, `aria-pressed`): full cyan border. Focus: one 2px cyan ring, offset 3px.
- Chips, the skills level legend and the About/History/Blog stats strip get plates instead of hairlines on art.
- Section heads get a dark pool behind the label, title and blurb (background gradient on a pseudo-element, never a mask).
- Section rules carry a tick scale after the cyan stub; the footer rule matches. Live/good `.cm-state` labels get a square pip.
- Defaults use `:where(.ctos)` so pressed chips, paper cards and page rules still win. Page CSS can override freely.
