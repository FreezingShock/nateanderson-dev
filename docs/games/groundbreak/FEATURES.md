# Groundbreak: features

Idle construction-company game. Route `/creations/games/groundbreak`. Audited 2026-11-15 against `integration` at 5138bb6f by reading the code and running the tests (35 pass). Backlog: [BACKLOG.md](./BACKLOG.md).

**State**: working = built and covered by a test or seen running; partial = built with a known gap (listed in the backlog); untested = built, no test and nobody has looked at it since.
**Tests**: `npm run test:nodefarm` runs them (a PR check). Pacing sim: `node --experimental-strip-types --no-warnings scripts/groundbreak/sim.mjs [hours]`.
**Browser tests**: none in the repo. Threads check the UI headless on a production build and attach 1440 and 390 PNGs.

## Where things live

| Area | Files |
|---|---|
| Rules (pure TS, no DOM) | `lib/groundbreak/engine.ts` (state, step, buy, jobs, incorporate, save), `data.ts` (every number, materials, jobs, cities, perks) |
| Console and cue | `lib/groundbreak/commands.ts`, `commands-qol.ts` (`gb` commands), `guide.ts` (next-step cue, welcome-back) |
| Game screen | `components/groundbreak/groundbreak.tsx` (HUD, dock, windows, input, camera, save loop), `icons.ts`, `scene-types.ts` (camera and scene contract) |
| Styles | `app/camino/groundbreak.css` |
| Scene art and life | `components/groundbreak-art/` (`site-scene.tsx` backdrop and jobs, `site-life.tsx` crew, vehicles, machines, `icons.ts`, `ui-art.ts`, generated `scene-data.ts` and `life-data.ts`, `art.css`) |
| Art generators | `scripts/groundbreak-art/` (`build-icons.py`, `build-scene.py`, `build-ui.py`, `build-life.py`; `gb_kit.py` is the dither canvas). Output in `public/groundbreak/{icons,jobs,backdrop,life,ui}` |
| Route and dev preview | `app/creations/games/groundbreak/{page,layout}.tsx`, `app/dev/groundbreak-art/page.tsx` (needs `VOXEL_BENCH=1` in production) |
| Fonts | `lib/groundbreak-fonts/` (Barlow Condensed 700 for display, IBM Plex Mono 400/500/600 for text; no 600 display face, every display style is 700) |
| Console hook | `components/cm/console.tsx` imports `gbCommand` |


Design notes live outside the repo in `/mnt/project-files/portfolio/groundbreak/` (SPEC.md, ENGINE-API.md, UI-SCENE-SLOT.md). SPEC.md still mentions a bid board; that was dropped for a fixed campaign order.

## Owners

One thread owns a file at a time. Two threads on one file stall silently.

| Files | Owner area |
|---|---|
| `lib/groundbreak/*` (rules, numbers) | Groundbreak gameplay thread |
| `components/groundbreak/groundbreak.tsx`, `app/camino/groundbreak.css` | Groundbreak QOL / UI thread |
| `components/groundbreak-art/*`, `scripts/groundbreak-art/*`, `public/groundbreak/*` | Groundbreak art threads (backdrop and buildings, icons and menu art, site life) |

Thread names change each wave; the file split is what matters. Before editing a file in another row, check the open PRs touching it.

## Features

### Economy

| Feature | State | Code | Test |
|---|---|---|---|
| 12 materials, unlocked in order, each paid in the one before; first job unlocks on its own material | working | `data.ts` MATS, UNLOCK_COST; `engine.ts` `unlock`, `openForWaitingJob` | engine.test: unlock, "next material opens by itself", "each job starts as soon as its own last material is open" |
| Forward boost (material n lifts n+1) and back boost from the last three, plus global extras | working | `engine.ts` `chain`, TUNE.fwd/back/extra | "forward boost ... last three feed back" |
| Three tiers per row: I crew (x1.15 cost), II equipment (x2 output, x8 cost), III method (once, needs 2 equipment) | working | `engine.ts` `buy`, `tierCost`; no bulk x1/x10/max by design | "buying tiers spends the right currency" |
| Crew milestone: every 25 crews doubles a row | working | `engine.ts` `rowMult` | engine.test "every 25 crews ... doubles" |
| Floors recipe (3 Concrete, 1 Steel, 1 Glass each) | working | `data.ts` RECIPE | "data tables are the right shape" and the bot run |
| Opening a material stocks 60 s of output | working | `engine.ts` unlock, TUNE.unlockGiftSecs | "opening a material stocks a minute" |
| Reputation lifts all production (+0.4% per point) | working | `engine.ts` `repMult` | engine.test "reputation lifts production" |
| City bonuses per region (material and effect multipliers) | working (material bonuses tested) | `data.ts` CITIES | engine.test "a region multiplies only the materials it lists" |

### Jobs

| Feature | State | Code | Test |
|---|---|---|---|
| Fixed campaign of 13 jobs across 5 stages; after the bridge the last 3 loop, harder each lap | working | `data.ts` JOBS, `jobAt`; `engine.ts` `lap` | "fixed campaign order" |
| Phases (prep, foundation, structure, envelope, MEP, fit-out), a job runs only the phases it has materials for | working | `data.ts` PHASES; `engine.ts` `plan`, `jobProgress` | the bot run and job tests |
| Permit wait, then build, then timed inspection; low score stretches the inspection, never fails it | working | `engine.ts` `startNext`, `inspectSecs` | "inspection score stretches but never fails" |
| Overtime: pay cash to end an inspection early | working | `engine.ts` `overtime` | "overtime ends an inspection early" |
| Change order: offered at the structure phase (middle phase on small jobs), 75 s to decide, +35% pay, costs build time and a tougher inspection | working | `engine.ts` `acceptChange`, `declineChange`; card in `groundbreak.tsx` shows pay, time, inspection | "change order is offered ...", "costs build time and a tougher inspection" |
| Progress draws: half the cash paid through the job, handover pays the rest | working | TUNE.draw | "progress draws pay through a long job" |
| Repeat order: while the next job waits on a material the crew rebuilds the last job for a share of pay and rep, no new building | working; named in the job card (pays and "no new building"), the Jobs window row and a finish toast| `engine.ts` `repeatJob`, `repeatPay`; "Repeat order" tag on the job card only | four repeat-order tests |
| Jobs window: next 4 jobs with pay, rep, stage and what they need | working | `groundbreak.tsx` Window "jobs" | none (UI) |

### Prestige and perks

| Feature | State | Code | Test |
|---|---|---|---|
| Incorporate: new firm in the next Bay Area region, keeps skyline and Charter points (sqrt of rep earned / 4), needs 60 rep | working; firm 2 about 40% and firm 3 about 45% faster than firm 1 in the bot run; the Firm window says what it gives | `engine.ts` `incorporate`, `charterGain` | "incorporate resets ...", "second firm beats the first" |
| 20 Charter perks in 3 branches (ops, money, logistics), with prerequisites | working | `data.ts` PERKS; `engine.ts` `buyPerk` | "perks need their requirements and charter" |
| Foreman and Fleet manager autobuy (spends at most 25% of what it holds) | working | `engine.ts` `auto` | "Foreman hires crews on its own" |
| Six regions, repeating with a growing scale | working | `data.ts` CITIES | covered by incorporate tests |

### Time, saves and catch-up

| Feature | State | Code | Test |
|---|---|---|---|
| Save in `gb-save-v1` (version 2), junk and foreign JSON refused, v1 saves migrated | working | `engine.ts` `parse`, `serialize`, `load` | "saves round-trip, survive junk", "v1 save is moved", "repeat orders survive a save" |
| Offline catch-up capped at 8 h (16 h with a perk), finite and fast | working | `engine.ts` `catchUp` | "a long catch-up is finite" |
| Welcome-back card after reload or a long background spell | working | `guide.ts` `awaySnap`, `awaySummary`; `AwayCard` | guide.test "welcome-back summary" |
| Rolling backups (two copies, five minutes apart) with Restore in the Menu; export and import | working | `groundbreak.tsx`, `lib/games/save` | none (UI) |
| Other-tab guard (a second tab never overwrites the save) | untested | `groundbreak.tsx` storage listener, `gb-conflict` | none |
| Pause on hidden tab, `P` pauses | untested | `useGameShell`, `togglePause` | none |
| Windowed panel under the site chrome with a title bar; scrolls into view and takes focus on load; keys and wheel stay with the game; full screen; save export/import in the panel footer | working headless at 1440 and 390 (production build); not on a real phone or in Safari | `components/games/shell/game-route-shell.tsx`, `lib/games/save-slot.ts`, `app/creations/games/groundbreak/layout.tsx` | `npm run test:window` (`scripts/games/window-check.mjs`) |

### Guidance and controls

| Feature | State | Code | Test |
|---|---|---|---|
| Next-step cue chip, Space or G does it (accept, unlock, buy, perk, incorporate, wait) | working | `guide.ts` `nextCue`, `doCue`; `CueChip` | guide.test cue order, "bot that only follows the cue keeps progressing" |
| Keys: 1-0 - = pick a material, `[` `]` cycle, Y/N change order, `+` `_` zoom, arrows pan, R or Home reset view, `?` Menu, Esc closes | working | `groundbreak.tsx` key handler | none (UI) |
| Site-wide shortcuts (`g` chord, `[` `]`, `?`) must exclude Groundbreak or the game keys do nothing | working, gotcha | `components/cm/keys.tsx` | none |
| Console `gb`: stats, hire, unlock, jobs, change, overtime, perks, incorporate, skyline, open, next, go, auto, rate; `give` and `warp` are admin-gated | working | `commands.ts`, `commands-qol.ts` | engine.test "console commands", guide.test console |
| Simple visuals toggle (`gb-simple`) | untested | `groundbreak.tsx` `toggleSimple` | none |
| Material dock: grouped tiles with number keys, level, progress to unlock, hover names | working on mouse; touch has no hover | `groundbreak.tsx` dock | none |

### Screen and art

| Feature | State | Code | Test |
|---|---|---|---|
| Side-on cross-section site, zoom 0.5 to 5x, drag, wheel, pinch; camera re-follows on a new job and after 40 s idle | working | `groundbreak.tsx`, `scene-types.ts`, `site-scene.tsx` | none (UI) |
| SF Bay golden-hour backdrop (sky, hills, city layers, bay, shore), palette locked | working | `site-scene.tsx`, `scripts/groundbreak-art/gb_backdrop.py` | none |
| 13 staged jobs drawn as frame strips; floor-by-floor rise on tall jobs | working | `public/groundbreak/jobs`, `gb_buildings.py` | none |
| Site life: crew on every floor, hoist cage, excavator, pump, mobile crane, forklift, delivery trucks, shore traffic, tap any worker or machine for a label | working | `site-life.tsx`, `life-data.ts`, `gb_life.py` | none |
| Ambient: clouds, bay glints, boats, signature tower per Incorporate | working | `site-scene.tsx` | none |
| Fog bank over the bridge saddle (2696bbd9) | untested in the running game | `site-scene.tsx` | none |
| Skyline window: every job in the game, named; built ones in colour with a count, unbuilt ones as dark silhouettes; 4 columns on desktop, 3 on phones | working | `SkylineView`, `groundbreak.tsx`; `.gb-sky` in `groundbreak.css` | none |
| Windows: Jobs, Skyline, Firm (perks), Console, Menu; each opens with its own animation and banner art | partial: Jobs and Firm open over the site | `Window` in `groundbreak.tsx`, `ui-art.ts` | none |
| 42 dither icons (64 px): materials, currencies, equipment, phases, perks, drawn from the one shared sheet | working | `components/groundbreak-art/icons.ts` (`GB_ICONS`), `build-icons.py`, `Ico` in `groundbreak.tsx` | none |
| Header: site board, location plate, stage and job progress; job card with phases and pay | working | `groundbreak.tsx` `gb-top`, `gb-job` | none |
| Phone layout under 860 px; landscape phone under 500 px high | partial | `groundbreak.css` media rules | none |

## Pacing

First run to the bridge is about 3 hours (Nate's pick). The bot test "finishes the campaign in about three hours" guards it. Nobody has played it by hand yet; see BACKLOG item 11.

### HUD layout

- Floating HUD stacks on the dock: `groundbreak.tsx` measures the dock and sets `--gb-dock-top`; the cue, view buttons, feed and card use it (`groundbreak.css`, last block). Phone landscape moves the cue to the top. No overlaps at 1440, 390, 360, 375x667, 844x390, 932x430 (headless Chrome only).
- Windows (Jobs, Skyline, Firm, Console, Menu): desktop, a 320 to 520 px panel docked beside the rail that ends above the dock, at least 200 px tall (on a short screen, about 657 px tall, the panel is at its 360 px minimum, so the window covers the top of the dock there; 2026-11-16), cue and feed hidden while open; phone, a bottom sheet over the dock (up to 50% tall, so the dig stays above it) with the top of the site showing, cue, view buttons and feed hidden. The material card is a sheet too (up to 50%). The welcome-back card is a strip under the header on phones, with the page line hidden (2026-11-16). Blank click and Esc close. `groundbreak.css`, last block. Headless Chrome only.
- Phone landscape (max-height 520): header 46 px, rail across the top (or down the side from 861 px), windows and material card sized by `--gb-dock-top`, cue top right and narrowed (no key hint), job card 200 px under 700 px wide. Checked 844x390, 932x430, 667x375 in headless Chrome only.
- Phone portrait (max-width 860, height over 520): the dock shows groups up to the newest open one and hides the ones still locked beyond it (`data-far`), so the dock is 92 px at the start (was 183) and 182 px at 360x740 (was 274). Mid-game it is the same as before. Headless Chrome only.
- Phone portrait screen (2026-11-16): the page intro, section head and save footer are hidden on this route (Menu keeps Export and Import), the title bar is one 40 px row with icon-only Pause and Full screen, and the frame fills the screen under it. The HUD title is hidden; the header keeps the city, cash and reputation (crews from 520 px down). The dig gets about 64% of a 390x844 screen above the dock (was about 30%). Headless Chrome only. Overlap fixes from the HUD check: on desktop screens 720 px tall or less the job card drops its banner and its body scrolls when a late save makes it taller, so it ends above the dock, and the toast feed shows only the newest toast so it clears the cue line (2026-11-16; checked 1440 by 657, 1440 by 720, 1440 by 760, 1366 by 657, 1280 by 600 and 1280 by 720); desktop zoom buttons are 40 px and sit at the lower left of the view (2026-11-16: at the right edge they hid under the job card on short screens and with a tall late-save card); under 520 px high the cue sits under the rail; on short landscape screens (932 x 430) the zoom row drops to the bottom corner. `scripts/ci/gb-hud.mjs` is clear at all seven sizes with the fresh and the late seed.
- Cue and toasts (2026-11-16): the cue's second line is a solid panel with brighter text. Toasts stack at the top right: on desktop left of the job card; on phone portrait one at a time under the job card (`groundbreak.css`, last block). Headless Chrome only.
- Dock locked tiles (2026-11-16): show the material name and what opening it costs (with the material it is paid in). Multiplier tags (crews, x81) are bigger. Curtain wall (tile -) has a new 3 by 4 panel icon, so it no longer matches Glass panels (tile 7); it shows once the tile is open. Generated by `scripts/groundbreak-art/build-icons.py`. Headless Chrome only.
- Pixel snap: 350 ms after the zoom stops, the art scale snaps to a whole device-pixel step if that moves it by 25% or less, so each art pixel is one width and walking workers do not flicker; mid-zoom stays smooth (`site-scene.tsx`). Headless Chrome only, checked at 1440 (rest 3 to 4 after one wheel step) and 390 at 2x.
- Corrupt or unreadable save: a copy is kept in `gb-save-v1-corrupt`, a fresh firm starts, and a sticky 20 s warning tells the player (the storage-blocked warning is sticky too). `groundbreak.tsx` `note(text, tone, sticky)`. Headless Chrome only.
- Hint ring (amber frame on the next dock tile, tier, or cue): shares `::after` with the tooltip, so it must reset the tooltip's box, background and hover shift (`groundbreak.css`, block after `.gb-tier[data-hint]`). Headless Chrome only.
- Console submit: the command runs in the submit handler, not inside the output's state updater (a `gb` command that changes the game would otherwise run during render). Headless Chrome dev build only.
- Firm window foot: the Incorporate button is pinned at the bottom while the perks and copy scroll (`.gb-win-foot`); on phones the perk rows come first, above the fade. Windows and the material card are near opaque. While the crew repeats a job the waiting cue also names what the next campaign job waits on (`guide.ts` `nextCue`). Headless Chrome only.

## Reward moments
- Material on site: the dock tile of a material that comes on site rings once (`.gb-unlock`, set from `pulse` in `components/groundbreak/groundbreak.tsx`, styles in the end of `app/camino/groundbreak.css`). Hot feed lines glow once as they land. Hidden in reduced motion. Checked headless with the admin console (`gb admin on`, `gb give gravel 500`, U).
- Job handover: the crew tick of the job that just finished stamps amber once (`freshTick` in `components/groundbreak/groundbreak.tsx`, `.gb-ticks li[data-fresh]` at the end of `app/camino/groundbreak.css`). Not yet captured in a frame.
- Counters: the cash chip eases to its new value (`Ticked`, `components/games/juice/ticked.tsx`).
