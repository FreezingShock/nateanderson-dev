# Starwright

An idle game about a star, at `/creations/games/starwright`. Original theme, art and mechanics. Incremental section of the Games hub.

## Layout
- `lib/starwright/data.ts`: the ten-element ladder (H He C O Ne Mg Si Fe Au U), recipes, heat gates, both perk trees (constellations, pulsar map), planets and every tuning number (`TUNE`). No React, no DOM.
- `lib/starwright/engine.ts`: pure state, `step`, `catchUp` (offline, 8 h, 24 h with Long watch), prestige (`supernova`, `neutronStar`, `blackHole`), saves (`parse` rebuilds from anything, `serialize`).
- `lib/starwright/art.ts`: the 320x180 Bayer-dither scene renderer (star, corona, dust ring, planets, supernova, black hole) and the chart backdrop.
- `lib/starwright/commands.ts`: the `sw` console command. The console runs it against the open game (`sw:live` event) or the saved game.
- `components/starwright/starwright.tsx`: the game component (scene, dock, collapse panel, fusion ladder, keys, tick). `panels.tsx`: Almanac, Orbit, star charts, Menu, visitor, birth clouds, ending. `sw-ui.tsx`: glyphs, element tiles, the floating tooltip (`data-tip="Title|line|line"`), `useLeaving` (keeps a menu mounted while it closes). `lib/starwright/ui-art.ts`: stand-in dither icons and textures drawn in code; `ui-sheets.ts` loads the art thread's PNGs from `public/starwright/manifest.json` and wins when a sheet exists. `app/camino/starwright.css`: styles. Route + layout in `app/creations/games/starwright` (uses `GameRouteShell`; the site chrome is hidden with `html.sw-route`).
- Save key `sw-save-v1`. Export/import use `lib/games/save.ts` (app id `starwright`).

## How it plays
- Hydrogen flows in (more as the star's mass grows). Each row burns element i into i + 1. Rows have three tier buttons (+1, +10, +100 levels; there is no x10 or max). Costs are paid in the burned element and grow 12% per press.
- Core heat is set by mass (monotone, spending never cools the star) and gates every fusion. Every 25 levels in a row doubles it.
- Alpha ladder: He is also eaten by C, O, Ne and Mg fusion, so helium has to be kept up.
- Supernova (iron at the collapse line) pays Stardust, kept perks stay. Each supernova in a neutron layer needs 2x the iron. Stardust buys the constellation map (18 stars in four named constellations). Autoburn (the Loom) buys tier I.
- Neutron star (6000 stardust in a layer): resets stardust and the map, pays Neutrons for the pulsar map, opens Gold and Uranium. Black hole (600,000 Uranium): the ending, then one Singularity (x2 everything) and a restart.
- Planets (8) are bought with leftover elements for passive bonuses. A supernova keeps them but sets them back to young (they regrow through their four stages); Survivors keeps their age. A neutron star or black hole clears them.

## Visitors, birth clouds, almanac, sound
- Visitors (`EVENTS` in data.ts): first one 40 s into a star, then one every 80 to 190 s while the game is open (never from time away). Two answers each, both good: a lump of output, or a timed boost. A visitor leaves after 150 s. `answer(s, 0|1)`.
- Birth clouds (`CLOUDS`): from the first supernova on, each new star offers three of six clouds; the pick lasts that one star. Not picking changes nothing.
- Almanac: codex of elements made (`CODEX` facts) and 21 milestones, each +2% to everything for good (`ACHIEVEMENTS`, tests in `ACH_TEST`). Key `A`.
- Sound: synthesized in `lib/starwright/sound.ts` (Web Audio, no files), starts after the first click or key, off switch (`sw-sound-v1`) and Low/Medium/High volume (`sw-volume-v1`) in the Menu. `play(name, { row, tier, con, kind })`. To hear everything: `node scripts/starwright/audio-render.mjs <dir>` writes a WAV per sound.
- Menus never scroll: `components/starwright/paged.tsx` measures and pages them. `scripts/starwright/ui-art/overflow-check.mjs` and `motion-check.mjs` check it against a production server.
- Console: `sw visitor [1|2]`, `sw cloud [id]`, `sw almanac`.

## Scene art
`lib/starwright/art.ts` draws the scene procedurally in dither. Star stages run a shift (ramp and size crossfade plus an ignition ring) when the star changes stage, and each stage has its own animation (proto jets and infall, dwarf prominences, giant breathing and shell, blue rays, supergiant wind and glint, iron shells and cracks). A collapse shows the old star imploding, then a warm (supernova) or cold (neutron star) blast, then the new star is born. Planets have four stages by time in orbit (`PLANET_STAGE_AT`), each with its own look per `Planet.look`. Visitors are drawn in the sky. Three skies by prestige layer. Drawn sprite sheets in `public/starwright/` (listed in `manifest.json`) are loaded by `lib/starwright/sprites.ts` and drawn by `renderLayered` in art.ts: sky, star stages and their transitions, implosion, blasts, planets, visitors. Anything missing or still loading falls back to the code drawing, so the scene never has a hole. File ownership and the sprite-sheet format for drawn art: `/mnt/project-files/portfolio/starwright/OWNERS.md`.

## Balance
`node --experimental-strip-types --no-warnings scripts/starwright/sim.mjs 30` plays a greedy bot at 1 s steps and prints each landmark. The bot answers every visitor at once and takes the first cloud. Current numbers (2026-11-15 pass): first supernova about 13 min, then 5, 7, 4, 4, 2, 1, 3 min as the map lights, first neutron star about 0.6 to 0.8 h, black hole about 2.2 h for the bot (about 1.7 h after the neutron star for a player who stays and chases uranium; it used to be over 6 h because the gold row cost 2e7 iron and sat idle for 20 minutes) (people are slower). A bot that acts every 10 s and buys the biggest tier under 90% of the stock collapses the first star in about 14 min (a test holds it under 25). Change numbers in `TUNE` and the data tables, not the engine.

## Rules changed 2026-11-15
Signed off by Nate ("Keep all three"); one file each in `docs/rule-changes/`:
- l5 Corona (Lantern): hydrogen inflow x2 and core heat x1.2, 900 stardust, needs l4.
- a5 Iron rain (Anvil): stardust from a supernova x2, 1800 stardust, needs a3 and a4.
- Deep stars: an endless stardust sink once the map is lit, +4% to everything each, first costs 600 and each costs x1.4 more.
- The map is now 20 stars (five per constellation).
- Away time with auto supernova on pays up to 3 supernovas per absence (his pick), see `2026-11-15-starwright-away-supernova-cap.md`.

## Deep stars
Where: the "Deep stars" panel at the bottom of the constellation map (key C), once every star is lit. Cost: `ceil(600 x 1.4^bought)` stardust (`TUNE.deepCost`, `deepGrow`). Each adds +4% to everything (`TUNE.deepBonus`, multiplied into `f.global`). Console: `sw deep` shows the count and next cost, `sw deep buy` lights one. A neutron star clears them (`s.deep = 0` in `neutronStar`), and so does a black hole. Code: `buyDeep`, `deepCost` in `engine.ts`; button in `components/starwright/star-chart.tsx`.

## The next-step line
`guide(s, f)` in the engine is the one line under the star: next unopened row, then the burner nearest iron that can be bought, then "Iron X of Y, about N min to the collapse" from the real iron flow (`collapseEta`). Before this it said "Gold and uranium wait for a neutron star" for the whole middle of a star.

## Saves, time away, settings (quality of life)
- `lib/starwright/session.ts`: `loadSession` never drops a save that will not parse (the text is kept under `sw-save-v1-corrupt`, the rolling `sw-save-v1-backup` is tried, the player is told). Backups are written before a neutron star or black hole, before an import or reset, and every 10 minutes (never over a backup with more play). `advance(s, gap)` credits every gap: up to 2 s is one step, longer is caught up like time away (before, gaps of 1 to 3 s were lost). `awayReport` builds the welcome-back lines (kept under `sw-away-v1` for `sw away`).
- `lib/starwright/settings.ts`: `sw-settings-v1` (scene full/simple, notices, welcome card, auto supernova, auto visitors). The two automations are opt-in and unlock with existing milestones: Ten stars (auto supernova at 100/150/200/300% of the collapse) and twelve visitors (take the lump or the boost). They also run during time away (a waiting visitor is answered, supernovas fire as the core passes the share) and are reported on the welcome card.
- One tab plays at a time (`BroadcastChannel` `sw-tab`): a newer tab tells older ones to stop saving; "Play here" swaps back.
- Keys: 1 to 9 buy, N supernova, Q/W answer a visitor, Space pause, F full screen, U sound, C P O A M panels, Esc.
- Console: `sw save`, `sw backup`, `sw restore [now]`, `sw corrupt`, `sw away`, `sw settings`, `sw set <name> <value>`, `sw keys`, `sw admin give|dust|neutrons|time` (a testing tool).
- Sprites (`sprites.ts`) load a sheet when the scene first asks for it; the rest trickle in two at a time after 1.5 s instead of ~100 requests at boot.
- UI: `components/starwright/settings.tsx` (Settings block in the Menu, welcome/problem card), `app/camino/starwright-qol.css`. Tests: `tests/starwright/session.test.mjs`.

## Tests
`tests/starwright/engine.test.mjs` runs in `npm run test:nodefarm` (saves, prestige resets, perk rules, no NaN over 24 h, console).

## Not tested
Safari/WebKit, real phones, and audio (synthesized, never heard in the cloud).

## GUI
The star fills the screen; the dock (top right), fusion ladder (right) and collapse panel (bottom left) float over it. Menus animate in their own way: constellations and pulsar map iris, orbit shutter, almanac wipe, menu settle. Names live in tooltips (hover); on touch the ladder shows a recipe line. Phones pin the star on top and scroll the panels under it.
