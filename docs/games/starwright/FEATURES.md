# Starwright: features

Route `/creations/games/starwright`. Audited 2026-11-15 against `integration` 5138bb6. Rules and numbers: `docs/starwright.md`. Next work: [BACKLOG.md](BACKLOG.md).

State key: **working** = code and tests exist, seen working headless. **partial** = works with a known gap (see the backlog). **untested** = no test and no check on a real device.

Test commands: `npm run test:nodefarm` (a PR check; includes `tests/starwright/*.test.mjs`, 41 tests), `node --experimental-strip-types --no-warnings scripts/starwright/sim.mjs 30` (balance bot). No browser test exists for Starwright; UI is checked by hand with `scripts/starwright/ui-art/shots.mjs`.

## Core loop (engine, no UI)
| Feature | State | Code | Test |
|---|---|---|---|
| Ten-element ladder H to U, recipes, heat gates, row milestones (x2 every 25 levels) | working | `lib/starwright/data.ts`, `engine.ts` (`step`, `rowRate`, `gateMK`) | engine.test: burns, buys, no NaN |
| Tier buttons I/II/III (+1/+10/+100 levels; never x10 or max) | working | `engine.ts` (`buy`, `cost`) | engine.test: buying a tier |
| Hydrogen inflow and core heat grow with mass | working | `engine.ts` (`inflow`, `heatTarget`) | engine.test |
| Supernova (iron at the collapse line), Stardust payout, next star needs 2x iron | working | `engine.ts` (`supernova`, `feNeed`, `seeds`) | engine.test: supernova |
| Neutron star (6000 stardust in a layer): resets map, pays Neutrons, opens Gold and Uranium | working | `engine.ts` (`neutronStar`) | engine.test: neutron/black hole |
| Black hole (600,000 Uranium), ending, Singularity (x2) and restart | working | `engine.ts` (`blackHole`) | engine.test; ending screen has a screenshot only |
| Next-step line `guide()` and collapse ETA | working | `engine.ts` (`guide`, `collapseEta`) | engine.test: guide |
| Autoburn (Loom perks) | working | `engine.ts` (`autoburn`) | partly: engine.test perks |
| Pacing of the first runs | working | `data.ts` `TUNE`, `scripts/starwright/sim.mjs` | engine.test: first visitor, deep rows, black hole in ~2 h |

## Perks and progression
| Feature | State | Code | Test |
|---|---|---|---|
| Constellation map: 20 stars in 4 constellations (Lantern, Kiln, Anvil, Loom) | working | `data.ts` `PERKS`, `engine.ts` `buyPerk` | engine.test: perks |
| New perks l5 Corona (inflow x2, heat x1.2, 900) and a5 Iron rain (stardust x2, 1800, needs a3 + a4) | working, rule change signed off by Nate | `data.ts`, node art in `scripts/starwright/ui-art/build.py` `NODES` | none specific |
| Pulsar map: 8 perks bought with Neutrons | working | `data.ts` `PULSAR_PERKS`, `engine.ts` `buyPulsar` | engine.test: neutron |
| Deep stars: endless stardust sink, +4% everything each, cost x1.4 each, cleared by a neutron star | working (button in the star map, `sw deep`) | `engine.ts` `buyDeep`; button `components/starwright/star-chart.tsx` `Deep`, wired in `starwright.tsx` | engine.test: deep stars, `sw deep` |
| Planets (8) with four stages by time in orbit, +20% per stage; Survivors keeps age | working | `data.ts` `PLANETS`, `engine.ts` `planetStage`, `buyPlanet` | engine.test: planets |
| Visitors (4) with two answers each; first at 40 s; never from time away | working | `data.ts` `EVENTS`, `engine.ts` `answer` | engine.test: visitors |
| Birth clouds (6), three offered per new star after the first supernova | working | `data.ts` `CLOUDS`, `engine.ts` `chooseCloud` | engine.test: clouds |
| Almanac: codex of elements and 21 milestones (+2% each) | working | `data.ts` `ACHIEVEMENTS`, `engine.ts` `checkAch` | engine.test: milestones, codex |

## Saves, time away, settings
| Feature | State | Code | Test |
|---|---|---|---|
| Save `sw-save-v1`, parse rebuilds from anything, export and import | working | `engine.ts` `parse`/`serialize`, `lib/games/save.ts` | engine.test: round-trip |
| Damaged save kept under `sw-save-v1-corrupt` (an older different one moves to `-corrupt-prev`), rolling backup, 10-minute backups | working | `lib/starwright/session.ts` | session.test |
| Time away: 8 h cap (24 h with Long watch), credit for stalled frames, welcome-back card | working | `engine.ts` `catchUp`, `session.ts` `advance`, `awayReport`, `components/starwright/settings.tsx` | session.test |
| Opt-in auto supernova and auto visitors (also during time away; a long absence pays up to 3 supernovas) | working | `session.ts` `advanceAuto`, `lib/starwright/settings.ts` | session.test |
| One tab plays at a time (`BroadcastChannel sw-tab`) | untested | `starwright.tsx` | none |
| Settings (`sw-settings-v1`): scene full/simple, notices, welcome card | working | `settings.ts`, `settings.tsx`, `app/camino/starwright-qol.css` | session.test (parse only) |
| Hotkeys: 1-9 buy, N, Q/W, Space, F, U, C P O A M, Esc | working headless: 1, C, Esc, N, Q, Space checked; the rest not | `starwright.tsx`, `commands.ts` `SW_KEYS` | `tests/starwright/browser/hotkeys.mjs` (by hand against a production server, not a PR check) |
| Console `sw ...` (stats, fuse, collapse, neutron, hole, perks, pulsar, planets, visitor, cloud, almanac, deep, save, backup, restore, corrupt, away, settings, set, keys, admin) | working | `lib/starwright/commands.ts` | engine.test: console, visitor/cloud/almanac, `sw deep`; save/away commands only through session.test |

## Scene and art
| Feature | State | Code | Test |
|---|---|---|---|
| 320x180 dither scene: six star stages with transitions, skies by prestige layer, planets by stage, visitors, supernova/neutron/black hole blasts | working | `lib/starwright/art.ts` (`render`, `renderLayered`), `sprites.ts`, sheets `public/starwright/**`, `manifest.json` | none; screenshots only |
| Code-drawn fallback for any missing or loading sheet | working | `art.ts` | none |
| Star sprite scale clamp (8x cap; keep it) | working | `art.ts` | none |
| Planets stripped by a neutron star break into eight tumbling rock chunks that glow gold to ash over 1.7 s, drawn above the blast (`fx/planet-gone`, 96 px x 24 frames; `art.ts` after the blast) | working headless | `scripts/starwright/art/scenery.py` `fx_planet_gone`, `art.ts` | `scripts/starwright/ui-art/planet-break.mjs` (records the canvas) |
| Sheet generators | working | `scripts/starwright/art/*` (`build.py`; bump `VERSION`) | none |
| Lazy sprite loading (first needed, then two at a time) | working | `sprites.ts` | none |
| Synthesized sound, off switch `sw-sound-v1` | untested (never heard) | `lib/starwright/sound.ts` | none |

## GUI
| Feature | State | Code | Test |
|---|---|---|---|
| Layout: dock, fusion ladder, collapse panel floating over the star; phones pin the star on top; held sideways the star sits left and panels scroll right (checked headless at 844x390 and 667x375, no real phone) | partial: no real phone check | `starwright.tsx`, `app/camino/starwright.css` | none |
| Menus with their own open/close animations (iris, shutter, wipe, settle), `useLeaving` | working | `panels.tsx`, `sw-ui.tsx` | none |
| Star map: per-star medallions, designations, zoom card, deep-star panel | working | `star-chart.tsx` | none |
| Orbit and Almanac cards with drawn art; Orbit tiles use the drawn sheets for all 8 planets at all 4 stages (the code drawing shows only while a sheet loads) | working | `panels.tsx` | `tests/starwright/art-manifest.test.mjs`; `scripts/starwright/ui-art/orbit-shots.mjs` |
| Drawn UI art (element tiles with 8-frame loops, dock, menu, node, ring and pulsar icons) | working | `scripts/starwright/ui-art/build.py` -> `public/starwright/ui/*`; bump `UI_V` in `sw-ui.tsx` and `?v=` in `starwright.css` | none; `shots.mjs` screenshots |
| Phone scroll cue "Scroll for the ladder": once, gone on the first page scroll, not shown held sideways (`ScrollHint` in `settings.tsx`) | working headless | `settings.tsx`, `starwright-qol.css`, `scripts/starwright/ui-art/hint-check.mjs` | hint-check script |
| Tooltips (`data-tip="Title|line"`), touch recipe lines | working | `sw-ui.tsx` | none |
| Game shell (full screen, pause on hidden tab, save export/import) | working | `lib/games/*`, `app/creations/games/starwright/*` | `scripts/games/shell-check.mjs` |

## Not tested anywhere
Safari/WebKit, real phones, audio, auto actions while the tab is hidden, the one-tab rule, hotkeys F U P A M W.

## Who owns which files
One owner per file; merge `integration` before every push. Historic split is in `/mnt/project-files/portfolio/starwright/OWNERS.md`; the owner threads below are the 2026-11-15 wave and are named by thread title.

| Owner thread | Files |
|---|---|
| Overhaul Starwright core gameplay loop | `lib/starwright/data.ts`, `engine.ts`, `commands.ts` rules parts, `scripts/starwright/sim.mjs`, `tests/starwright/engine.test.mjs`, `docs/starwright.md` rules sections |
| Add Starwright quality of life features | `lib/starwright/session.ts`, `settings.ts`, `components/starwright/settings.tsx`, `app/camino/starwright-qol.css`, `tests/starwright/session.test.mjs` |
| Draw new Starwright stars, planets and skies | `lib/starwright/art.ts`, `sprites.ts`, `scripts/starwright/art/*`, `public/starwright/{star,planet,bg,visitor,fx}/*`, `manifest.json` |
| Draw new Starwright menus and icons | `components/starwright/*` (except settings), `starwright.css`, `scripts/starwright/ui-art/*`, `public/starwright/{ui,icon,card,panel}/*`, `ui-art.ts`, `ui-sheets.ts` |
