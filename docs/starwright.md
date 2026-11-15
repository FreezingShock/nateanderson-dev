# Starwright

An idle game about a star, at `/creations/games/starwright`. Original theme, art and mechanics. Incremental section of the Games hub.

## Layout
- `lib/starwright/data.ts`: the ten-element ladder (H He C O Ne Mg Si Fe Au U), recipes, heat gates, both perk trees (constellations, pulsar map), planets and every tuning number (`TUNE`). No React, no DOM.
- `lib/starwright/engine.ts`: pure state, `step`, `catchUp` (offline, 8 h, 24 h with Long watch), prestige (`supernova`, `neutronStar`, `blackHole`), saves (`parse` rebuilds from anything, `serialize`).
- `lib/starwright/art.ts`: the 320x180 Bayer-dither scene renderer (star, corona, dust ring, planets, supernova, black hole) and the chart backdrop.
- `lib/starwright/commands.ts`: the `sw` console command. The console runs it against the open game (`sw:live` event) or the saved game.
- `components/starwright/starwright.tsx`: the whole UI. `app/camino/starwright.css`: styles. Route + layout in `app/creations/games/starwright` (uses `GameRouteShell`; the site chrome is hidden with `html.sw-route`).
- Save key `sw-save-v1`. Export/import use `lib/games/save.ts` (app id `starwright`).

## How it plays
- Hydrogen flows in (more as the star's mass grows). Each row burns element i into i + 1. Rows have three tier buttons (+1, +10, +100 levels; there is no x10 or max). Costs are paid in the burned element and grow 12% per press.
- Core heat is set by mass (monotone, spending never cools the star) and gates every fusion. Every 25 levels in a row doubles it.
- Alpha ladder: He is also eaten by C, O, Ne and Mg fusion, so helium has to be kept up.
- Supernova (iron at the collapse line) pays Stardust, kept perks stay. Each supernova in a neutron layer needs 1.5x the iron. Stardust buys the constellation map (18 stars in four named constellations). Autoburn (the Loom) buys tier I.
- Neutron star (3000 stardust in a layer): resets stardust and the map, pays Neutrons for the pulsar map, opens Gold and Uranium. Black hole (250,000 Uranium): the ending, then one Singularity (x2 everything) and a restart.
- Planets (8) are bought with leftover elements for passive bonuses. A supernova strips them unless Survivors is lit.

## Visitors, birth clouds, almanac, sound
- Visitors (`EVENTS` in data.ts): first one 75 s into a star, then one every 80 to 190 s while the game is open (never from time away). Two answers each, both good: a lump of output, or a timed boost. A visitor leaves after 150 s. `answer(s, 0|1)`.
- Birth clouds (`CLOUDS`): from the first supernova on, each new star offers three of six clouds; the pick lasts that one star. Not picking changes nothing.
- Almanac: codex of elements made (`CODEX` facts) and 21 milestones, each +2% to everything for good (`ACHIEVEMENTS`, tests in `ACH_TEST`). Key `A`.
- Sound: synthesized in `lib/starwright/sound.ts`, starts after the first click or key, off switch in the menu (`sw-sound-v1`).
- Console: `sw visitor [1|2]`, `sw cloud [id]`, `sw almanac`.

## Balance
`node --experimental-strip-types --no-warnings scripts/starwright/sim.mjs 30` plays a greedy bot at 1 s steps and prints each landmark. The bot answers every visitor at once and takes the first cloud. Current numbers: first supernova about 25 min, first neutron star about 55 min, black hole about 3.2 h for the bot (people are slower). Change numbers in `TUNE` and the data tables, not the engine.

## Tests
`tests/starwright/engine.test.mjs` runs in `npm run test:nodefarm` (saves, prestige resets, perk rules, no NaN over 24 h, console).

## Not tested
Safari/WebKit, real phones, and audio (synthesized, never heard in the cloud).
