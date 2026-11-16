# __NAME__

The game at `/creations/games/__SLUG__`. Made by `npm run new-game -- __SLUG__` from the template in `docs/games/NEW-GAME.md`.

## Where things are

- `app/creations/games/__SLUG__/layout.tsx`: the route shell, windowed, game id `__SLUG__`.
- `app/creations/games/__SLUG__/page.tsx`: metadata and the panel.
- `components/__SLUG__/__CAMEL__.tsx`: the panel. Draws the game, runs the clock, saves.
- `lib/__SLUG__/engine.ts`: the rules. Pure, no DOM or React. Tested in `tests/__SLUG__/`.
- `app/camino/__SLUG__.css`: the palette (`data-theme="__SLUG__"`) and the panel layout.
- `docs/games/__SLUG__/`: this README, FEATURES.md (what exists) and BACKLOG.md (what to do next).

The template also added lines to shared files, each tagged `gen:__SLUG__`: `lib/games/registry.ts`, `lib/saves/keys.ts`, `lib/games/save-slot.ts`, `lib/game-launch/launch.ts`, `lib/creations-data.ts`, `docs/OWNERS.md`, `docs/README.md`, `scripts/games/games-under-check.json` and `package.json`.

## Save

Saved through the shared save system (`docs/saves.md`). Key `__SLUG__-save-v1`, envelope app `__SLUG__`, version 1, defined as `SAVE_DEF` in the engine and listed in `lib/saves/keys.ts`. Export and import are the shell's buttons under the panel. A damaged save is kept under `__SLUG__-save-v1-corrupt`, and an older different copy under `-corrupt-prev`.

## Checks

```
npm run test:__SLUG__                       # engine tests, no browser
npm run build                               # production build
SITE_PASSWORD=ci-password npx next start -p 3123 &
node scripts/games/window-check.mjs http://localhost:3123   # panel layout, keys, wheel, save buttons
node scripts/games/shell-check.mjs http://localhost:3123    # shell mounts, no page errors, no sideways scroll
```

Safari, iPhone full screen and real audio are not covered by these checks.

## Removing a throwaway game

`npm run new-game -- __SLUG__ --remove` deletes the folders above and every line tagged `gen:__SLUG__`.
