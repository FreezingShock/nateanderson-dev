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
| Fonts | `lib/groundbreak-fonts/` |
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
| Crew milestone: every 25 crews doubles a row | untested | `engine.ts` `rowMult` | none directly |
| Floors recipe (3 Concrete, 1 Steel, 1 Glass each) | working | `data.ts` RECIPE | "data tables are the right shape" and the bot run |
| Opening a material stocks 60 s of output | working | `engine.ts` unlock, TUNE.unlockGiftSecs | "opening a material stocks a minute" |
| Reputation lifts all production (+0.4% per point) | untested | `engine.ts` `repMult` | none |
| City bonuses per region (material and effect multipliers) | untested | `data.ts` CITIES | none |

### Jobs

| Feature | State | Code | Test |
|---|---|---|---|
| Fixed campaign of 13 jobs across 5 stages; after the bridge the last 3 loop, harder each lap | working | `data.ts` JOBS, `jobAt`; `engine.ts` `lap` | "fixed campaign order" |
| Phases (prep, foundation, structure, envelope, MEP, fit-out), a job runs only the phases it has materials for | working | `data.ts` PHASES; `engine.ts` `plan`, `jobProgress` | the bot run and job tests |
| Permit wait, then build, then timed inspection; low score stretches the inspection, never fails it | working | `engine.ts` `startNext`, `inspectSecs` | "inspection score stretches but never fails" |
| Overtime: pay cash to end an inspection early | working | `engine.ts` `overtime` | "overtime ends an inspection early" |
| Change order: offered at the structure phase (middle phase on small jobs), 75 s to decide, +35% pay, costs build time and a tougher inspection | working | `engine.ts` `acceptChange`, `declineChange`; card in `groundbreak.tsx` shows pay, time, inspection | "change order is offered ...", "costs build time and a tougher inspection" |
| Progress draws: half the cash paid through the job, handover pays the rest | working | TUNE.draw | "progress draws pay through a long job" |
| Repeat order: while the next job waits on a material the crew rebuilds the last job for a share of pay and rep, no new building | working (UI label partial) | `engine.ts` `repeatJob`, `repeatPay`; "Repeat order" tag on the job card only | four repeat-order tests |
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
| Skyline window: finished buildings on a shoreline | working | `SkylineView`, `groundbreak.tsx` | none |
| Windows: Jobs, Skyline, Firm (perks), Console, Menu; each opens with its own animation and banner art | partial: Jobs and Firm open over the site | `Window` in `groundbreak.tsx`, `ui-art.ts` | none |
| 42 dither icons (64 px): materials, currencies, equipment, phases, perks | working | `components/groundbreak-art/icons.ts`, `build-icons.py` | none |
| Header: site board, location plate, stage and job progress; job card with phases and pay | working | `groundbreak.tsx` `gb-top`, `gb-job` | none |
| Phone layout under 860 px; landscape phone under 500 px high | partial | `groundbreak.css` media rules | none |

## Pacing

First run to the bridge is about 3 hours (Nate's pick). The bot test "finishes the campaign in about three hours" guards it. Nobody has played it by hand yet; see BACKLOG item 11.

### HUD layout

- Floating HUD stacks on the dock: `groundbreak.tsx` measures the dock and sets `--gb-dock-top`; the cue, view buttons, feed and card use it (`groundbreak.css`, last block). Phone landscape moves the cue to the top. No overlaps at 1440, 390, 360, 375x667, 844x390, 932x430 (headless Chrome only).
- Windows (Jobs, Skyline, Firm, Console, Menu): desktop, a 320 to 520 px panel docked beside the rail that ends above the dock, cue and feed hidden while open; phone, a bottom sheet over the dock (up to 58% tall) with the top of the site showing, cue, view buttons and feed hidden. Blank click and Esc close. `groundbreak.css`, last block. Headless Chrome only.
