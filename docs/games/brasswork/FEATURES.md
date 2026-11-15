# Brasswork: features

Audited 2026-11-15 against `integration` at 5138bb6. Route `/creations/games/brasswork`. Update the row when a PR changes a feature. Open work lives in [BACKLOG.md](BACKLOG.md). Workflow rules live in `docs/WORKFLOW.md`.

**States:** `working` = built, merged, covered by a test or checked headless. `partial` = exists with a known gap (see the backlog id). `untested` = built, nobody has verified it on a real device or on screen. Nate has not played most of it on the live site, so nothing here is "approved" beyond the picks recorded in project memory.

**Screenshot and check scripts** (run against `next start` on a production build, headless Chrome with software WebGL; headers explain usage): `scripts/automation/shoot.mjs` (screenshot), `next-markers.mjs` (opening NEXT markers), `measure-open.mjs` (first node clear of the dock).

**Test commands:** `npm run test:automation` (184 pass, headless Node, no browser). `test:nodefarm` runs it too and is a PR check. `npm run test:automation:browser` (29 checks, about 11 s, needs the cloud Chromium) drives the input layer on a plain canvas with mouse and touch; it is not a PR check. There is no test for anything drawn on screen: the renderer, the HUD, audio and the phone layout are checked by hand with screenshots.

## Map of the code

| Area | Path | Notes |
|---|---|---|
| Page and host | `app/creations/games/brasswork/`, `components/brasswork/brasswork-host.tsx` | Mounts sim, renderer, input, HUD. Autosave `brasswork-save-v1`. Dev hook `?bwdev=1` exposes `window.__bwdev` |
| Simulation | `lib/automation/sim/` (`world.ts`, `progress.ts`, `hud.ts`, `grid.ts`, `save.ts`, `data.ts`), `lib/automation/types.ts` | Pure TypeScript, runs in Node. Engine numbers only in `sim/data.ts` |
| Recipe data | `lib/automation/data/tree.ts`, `analyze.ts` | Items, machines, recipes, research, milestones, hub requests. `npm run check:automation` solves the tree |
| Input | `lib/automation/input/` | Camera, picking, build strokes, keys, touch bar |
| Renderer | `lib/automation/render/` | Three.js 0.186.1 voxel island. Loaded with a dynamic import |
| Models | `lib/automation/models/` (machines, belts, items, resources, props, `registry.ts`) | Shared voxel format in `format.ts` |
| Art and icons | `scripts/brasswork/*.py` build `public/brasswork/*`; indexes in `lib/automation/icons/`, `lib/automation/art/`; components in `components/brasswork-art/` | Regenerate with the build scripts, never edit the sheets by hand |
| HUD and menus | `components/automation/`, `components/brasswork-ui/`, `components/brasswork/`, `app/camino/brasswork.css` | `MenuWindow` in `brasswork-ui/window.tsx` |
| Audio | `lib/automation/audio/` | Web Audio synthesis, no sample files |
| Settings and first run | `lib/brasswork/` | Settings in localStorage, quest flag |
| Dev pages | `/dev/voxel-island`, `/dev/voxel-model`, `/dev/brass-kit`, `/dev/brass-art`, `/dev/brasswork-site`, `/automation-preview` | Bench pages 404 on a production build unless `VOXEL_BENCH=1`; use `next dev` |

Owners are per area, one thread per file set. The threads: "Streamline Brasswork building and controls" (`input/`, build bar), "Make Brasswork progression more satisfying" (`sim/`, `data/`), and the three art threads for island and sky (`render/`), menu art (`components/brasswork-ui`, `components/automation`) and item and machine icons (`components/brasswork-art`, `scripts/brasswork/`). If a thread for an area is finished, a fresh thread may take its files; say so in the PR.

## Simulation

| Feature | State | Code | Test |
|---|---|---|---|
| World, grid, deposits (first workshop nodes: `START_NODE_SPOTS` in `sim/data.ts`), place and remove with footprints and rotation | working | `sim/world.ts`, `sim/grid.ts` | `sim.test.mjs`, `drills.test.mjs` |
| Belts in three tiers carrying items in lanes | working | `sim/world.ts`, `sim/data.ts` | `belts.test.mjs`, `belt-tiers.test.mjs` |
| Logistics: splitter, merger, tunnels (5 cells), loader, unloader with item filter, crate (200), strongbox (1000), dock (3x3) | working | `sim/world.ts`, `sim/data.ts` | `logistics-tiers.test.mjs`, `unloader.test.mjs` |
| Machines-first item priority on belts (`leadsToHub`) | working: machines take output first, then the hub, docks and crates share what is left round-robin; a full crate sends everything on (belts only feed the cell ahead, so a belt passing a crate never fills it) | `sim/world.ts` (`pushOutput`) | `progression.test.mjs` |
| Drills on nodes: purity multiplier, work from any of their four cells | working | `sim/world.ts`, `data/tree.ts` | `drills.test.mjs`, `resources.test.mjs` |
| Crafting machines (kiln, furnace, press, lathe, drawer, assembler, fabricator), recipes, buffers | working | `data/tree.ts`, `sim/world.ts` | `recipes.test.mjs`, `sim.test.mjs` |
| Power: windmills 50 kW over 8 cells with gusts, spring winder steady 60 kW, spring store battery, unused power shared | working | `sim/world.ts` (`windAt`, `chargeOf`) | `power-detail.test.mjs`, `power-share.test.mjs` |
| Research tree: 16 core nodes, 5 alternate recipes, 6 mastery nodes; research enforced | working | `data/tree.ts`, `sim/progress.ts` | `research-gate.test.mjs`, `progression.test.mjs` |
| Hub requests (4 early deliveries) and 5 milestones paying blueprints | working | `data/tree.ts`, `sim/progress.ts` | `hub-requests.test.mjs`, `hub-costs.test.mjs` |
| Commissions after Sky orrery first light, repeating and scaling | working | `sim/data.ts`, `sim/progress.ts` | `progression.test.mjs` |
| Supply crates on orders and milestones | working | `sim/progress.ts` | `progression.test.mjs` |
| Prestige "Open a new workshop": 4 sites, workshop kit, site bonuses | working | `sim/progress.ts`, `sim/data.ts` | `sites.test.mjs` |
| New-player opening (drill, kiln, windmill, belts, first milestone) | working | `sim/data.ts` (`STARTER_KIT`: 80 iron plates) | `opening.test.mjs` |
| Save and load, versioned (`SAVE_VERSION` 1), offline catch-up up to 8 h, run in 10 ms slices on load (`catchUpAway` in the host) so the page stays responsive; `resolve()` and belt-to-store answers are cached | working | `sim/save.ts`, `sim/world.ts` (`catchUp`), `brasswork-host.tsx` | `sim.test.mjs`, `save-golden.test.mjs` (checked-in v1 save keeps playing 60 s) |
| Day clock, 1200 s day | working | `sim/progress.ts` (`dayClock`) | none direct |
| Full-run pacing | untested: no bot plays start to prestige (B-05) | none | none |

## Input and camera

| Feature | State | Code | Test |
|---|---|---|---|
| Orbit camera, top-down toggle (T), WASD and arrow pan, zoom (+ and -) | working | `input/camera.ts`, `input/keys.ts` | `input.test.mjs` |
| Click and drag belt strokes, auto-route between machines, placement ignores machine bodies | working | `input/build.ts`, `sim/grid.ts` (`autoRoute`) | `input.test.mjs` |
| Multi-cell ghost, rotate (R), pipette (Q), undo and redo, Delete on hover, X Remove mode | working | `input/index.ts`, `input/build.ts` | `input.test.mjs` |
| Shift-drag area Remove | working | `input/pointer.ts`, `input/build.ts` | `input.test.mjs` |
| Copy and paste of building areas: Shift-drag with no tool selects, Ctrl/Cmd+C copies (or the building under the cursor), Ctrl/Cmd+V arms a paste that stays armed to stamp again, R turns the whole layout, Esc or right-click puts it away; one undo per paste; parts that are blocked, locked or unaffordable are skipped and counted in the note; the hub is never copied. Desktop only (no touch path yet) | working in headless Chrome | `input/build.ts`, `input/keys.ts`, `input/pointer.ts` | `input.test.mjs`, `scripts/automation/copy-paste-check.mjs` |
| Number keys 1 to 9 pick from the open build group, Tab cycles groups | working | `input/keys.ts`, `components/automation/build-bar.tsx` | `input.test.mjs` |
| Copy and paste of building areas | not built (B-06) | none | none |
| Touch: long-press, line stroke, two-tap belt routing, touch bar (Top, Rotate, Undo, Redo, Remove, Cancel), all 44 px | working in the browser harness; untested on a real phone | `input/touch-bar.ts` | `input.test.mjs` (logic only) |
| Browser check of the input layer (desktop mouse and keys, phone touch through CDP, touch bar at 44 px) | working | `tests/automation/browser/` | itself |

## Renderer

| Feature | State | Code | Test |
|---|---|---|---|
| Voxel island, terrain, mesher with AO, fog, grass in wind | working | `render/index.ts`, `mesher.ts`, `terrain.ts`, `grass.ts`, `fog.ts` | none |
| Sky with sun elevation by clock, stars, moon, shooting stars, cirrus; clouds | working | `render/sky.ts`, `clouds.ts`, `lighting.ts`, `config.ts` | none |
| Sea: baked shore height map, foam, glints, three palettes (verdigris default) | working | `render/water.ts` | none |
| Horizon islands and night lighthouse beam | working | `render/horizon.ts` | none |
| Dither post pass (6 levels, pixel 3, toggle), quality governor | working | `render/postfx.ts`, `governor.ts` | none |
| Machines with working, clock and charge states, hub growth stages 0 to 3, ore node boards | working | `render/models.ts`, `models/machines/`, `models/resources/node.ts` | `machine-models.test.mjs`, `resources.test.mjs` |
| Belts with moving slats, items riding the belt | working | `models/belts/`, `render/beltitems.ts` | `belts.test.mjs` |
| Scenery props and life (gulls, butterflies, fish) | working | `models/props/`, `render/scenery.ts`, `render/life/` | none |
| Bursts for place, remove, milestone, research, unlock, delivery | working: island bursts and life bursts skip under Simple visuals, Low fx and reduce motion (`setLowFx`) | `render/effects.ts`, `render/life/` | `effects-lowfx.test.mjs` (island bursts) |
| Hub delivery light column (shimmer, PR #541) | untested: not visible in software WebGL, needs a real GPU (B-03) | `render/life/` | none |
| Low-fx and reduce-motion modes | untested on a real GPU | `render/index.ts` (`setLowFx`), `.ab-root[data-reduce]`, `[data-lowfx]` | none |

## HUD and menus

| Feature | State | Code | Test |
|---|---|---|---|
| Build dock: Logistics, Machines, Power sections, big tiles with in-hand state | working | `build-bar.tsx`, `build-tile.css`, `brasswork/build-popover.tsx` | `icon-coverage.test.mjs` |
| Hover names on tiles, resource boxes and machines (PR #545) | working: `scripts/automation/hover-names.mjs` checks all three show a name and clear on leave, and that touch leaves no stuck tag (headless Chrome) | `brasswork/hover-name.tsx` | none |
| NEXT banner and on-island marker (drill, kiln, windmill, hub) | working: `scripts/automation/next-markers.mjs` walks the opening headless and checks each marker is on its cell (within 4 px) and disappears at the end; run on a production build at 1440 and 390 | `brasswork/next-marker.tsx`, `host` `syncTarget`, `sim/hud.ts` | `hud-next.test.mjs` (banner text only) |
| Resource strip with drawn icons and counts, essential resources always shown | working | `resource-strip.tsx`, `sim/hud.ts` | none |
| Inspector: recipe, rates, buffers, power, unloader filter; Esc and ground click close it | working | `inspector.tsx` | `machine-detail.test.mjs` |
| Hub menu (unlocks first, fill progress, requests) and toast | working | `hub-menu.tsx` | `hub-requests.test.mjs` |
| Milestones window (summary numbers, hero, route, prestige header) | working | `milestones-window.tsx` | none |
| Research screen: tree, pop-up beside card, alternates mixed in, per-state art; window 940 px wide so all seven columns show without sideways scroll; `research-check.mjs` checks cards, art, names, focus and console | working | `research-screen.tsx`, `research-screen.css` | `research-gate.test.mjs` (rules only) |
| Expedition window: four site cards with art, ore dots, one line of text; "Plan the move" opens the prestige window where hold to confirm works with keyboard and pointer/touch (`expedition-check.mjs`) | working; cards vs big view is Nate's call (T-01) | `expedition-window.tsx`, `prestige-screen.tsx` | `sites.test.mjs` (rules only) |
| Production stats: headline numbers, running-down callout, ledger by output | partial: ledger vs two columns is Nate's call (T-02) | `production-window.tsx` | none |
| Settings: sound, reduce motion, low fx, number format, lighting mood, volumes, save export and import | partial: grouped list vs tiles is Nate's call (T-03) | `settings-window.tsx`, `brasswork/settings-extras.tsx`, `audio-rows.tsx`, `lib/brasswork/settings.ts` | none |
| Starter quest scroll (drill, kiln, belt, delivery), skippable, never returns | working | `brasswork/first-run.tsx`, `lib/brasswork/first-run.ts` | `opening.test.mjs` (the steps) |
| Codex of every machine | working | `brasswork/codex.tsx` | none |
| Away report after 2 minutes or more offline | working | `brasswork/extras.tsx`, host | none |
| Phone layout: bottom sheets, 4-across resource boxes, machine preview before placing, Milestones sheet, More menu; every tap target 44 px or more (`tap-targets.mjs` checks main view, four sheets and five More windows) | partial: sheet groups and animation (B-10); untested on a real phone | `phone-menu-art.css`, `automation-hud.tsx` | none |
| `MenuWindow` (sizes 640, 960, 1160; variants iris, shutter, settle; bottom sheet under 768 px); focus moves into it on open, Tab stays inside, focus returns to the opener on close | working | `brasswork-ui/window.tsx` | none |

## Audio

| Feature | State | Code | Test |
|---|---|---|---|
| Synthesized effects, ambient bed (wind, night, machines), UI hover and press sounds, three volume sliders | untested: never heard on a real device (B-12) | `lib/automation/audio/` | none |

## Art pipeline

| Feature | State | Code | Test |
|---|---|---|---|
| Item and machine icon sheets (128 px plus a 64 px sheet) | working | `scripts/brasswork/build-icons.py`, `lib/automation/icons/index.ts` | `item-icons.test.mjs`, `icon-coverage.test.mjs` |
| HUD glyph sheet (append-only cell order) | working | `build-ui-icons.py`, `icons/ui.ts` | `ui-icons.test.mjs` |
| Menu art: portraits, rarity frames, research, milestone and site art | working | `build-menu-art.py`, `lib/automation/art/index.ts` | `menu-art.test.mjs` |
| Window art: banners, frame, grain per menu theme | working | `build-window-art.py`, `public/brasswork/window` | none |
| Item belt models, machine models (13), resource and prop models | working | `lib/automation/models/` | `item-models.test.mjs`, `machine-models.test.mjs` |

**Rules the tests enforce:** a change to a machine model in `models/machines/` must also redraw its menu art and icon (`bw_machines.py`, then `build-menu-art.py` and `build-icons.py`). Every catalog id needs an icon. `models/registry.ts` conflicts on almost every merge: keep all lists.
