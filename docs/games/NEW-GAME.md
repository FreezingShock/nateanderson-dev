# Make a new game

One command makes a playable windowed game: route, panel, engine, save slot, registry entries, a Creations card,
engine tests, the window and shell checks, and docs. The starter is an incremental loop (tap, generators, upgrades,
offline progress, big numbers, prestige), so the template proves the plumbing. Replace its numbers and art with the real design.

## Make one

```
npm run new-game -- <slug> --name "Display Name" --section incremental --accent "#7fd6a4" --resource "Stock"
```

- `<slug>`: lowercase, digits and single dashes, 3 to 24 characters, starting with a letter. It is the URL segment, the save key prefix and the folder names.
- `--name`: letters, digits, spaces and hyphens only. Default is the slug in title case.
- `--section`: `incremental` (default), `automation` or `geography`. Sets the Games hub section and the card's icon.
- `--accent`: 6-digit hex. The panel's palette.
- `--resource`: the name shown on the stage, such as "Stock" or "Scrap".
- `--dry-run`: lists the files without writing.

Then:

```
npm run test:<slug>        # engine tests, no browser
npm run dev                # http://localhost:3000/creations/games/<slug>
```

The card in the Games hub shows as "In Development" until you make it live (see below). The route works from the start.

## What it writes

New files (all named after the slug):

| Path | What it is |
|---|---|
| `app/creations/games/<slug>/layout.tsx` | Windowed route shell, the same one Brasswork, Starwright and Groundbreak use |
| `app/creations/games/<slug>/page.tsx` | Metadata from the registry, and the panel |
| `components/<slug>/<Name>.tsx` | The panel: draws the game, runs the clock, saves |
| `lib/<slug>/engine.ts` | The rules. Pure functions over a plain object, no DOM or React |
| `tests/<slug>/engine.test.mjs` | Engine tests, run by `npm run test:<slug>` |
| `app/camino/<slug>.css` | Palette (`data-theme="<slug>"`) and panel layout |
| `docs/games/<slug>/README.md`, `FEATURES.md`, `BACKLOG.md` | Docs in the format of docs/WORKFLOW.md |

Lines added to shared files. Each one ends with `gen:<slug>` (or `<!-- gen:<slug> -->` in markdown):

- `lib/games/registry.ts`: the game id, the theme, and the `GAMES` entry (name, path, eyebrow, description, play title, back link)
- `lib/saves/keys.ts`: the save slot (`<slug>-save-v1`, version 1)
- `lib/games/save-slot.ts`: the export and import hook (`defFor` returns the engine's `SAVE_DEF`)
- `lib/game-launch/launch.ts`: the line the hub shows for a saved game
- `lib/creations-data.ts`: the Creations card, in the chosen section
- `docs/OWNERS.md` and `docs/README.md`: the ownership line and the docs index link
- `scripts/games/games-under-check.json`: the game is in the window and shell suites of the game checks (marked `template: true`; `scripts/ci/checks/games.mjs` reads the list)
- `package.json`: the `test:<slug>` script

Nothing else in a shared file is touched. The generator refuses to run when a slug already exists, and it writes nothing
until every anchor it needs is found.

## Shared kit

The starter runs on `lib/game-kit` (see docs/game-kit.md). The engine imports `idle`, `time` and `format` by relative path, and the panel uses `useGameClock`, `useAutosave` and `useToasts`. Build new mechanics on the kit's helpers (`stepChain`, `costAt`, `upgradeMult`, `prestigeGain`, `catchUp`) so every game prints and saves the same way.

## Save

The save runs on the shared save system, `docs/saves.md`. The key, app and version live in one place, `lib/saves/keys.ts`. The engine's `SAVE_DEF` (`lib/<slug>/engine.ts`) points at that entry and turns the state into plain data (`dump`) and back (`revive`). `loadSave` and `writeSave` from `lib/saves/core.ts` do the reading and writing.

- Damage: a save that will not load is never dropped. Its text is kept under `<key>-corrupt` (an older different copy under `-corrupt-prev`), and the player sees a toast.
- Migrations: before you change the State shape, bump the version in `lib/saves/keys.ts` and add `migrations[oldVersion]` to `SAVE_DEF`. Keep every migration forever, and add a fixture test under `tests/saves/`.
- Export and import: the shell's buttons. Export writes the migrated envelope, and import checks the file and stages it, as in `lib/games/save-slot.ts`.

## Make it live

1. In `lib/creations-data.ts`, set the card's `status` to `"playable"`, and add `href: "/creations/games/<slug>"` and a `shot` (a 960 by 600 capture of the built game under `public/games/shots/`).
2. Re-run `npm run test:<slug>`, `npm run build`, and both checks below.

## Checks

After `npm run build`, against a production server (CI password shown; the real site password is not needed):

```
SITE_PASSWORD=ci-password npx next start -p 3123 &
node scripts/ci/checks/run.mjs window http://localhost:3123 out-dir
node scripts/ci/checks/run.mjs shell http://localhost:3123
```

- The `window` suite (`docs/ci.md`, "Game checks") runs every game in `games-under-check.json` at 1440, 390 and 1366x657. It checks the panel mounts, the game root fills it, keys and the wheel stay with the game, the title bar scrolls the page, the save buttons answer, and no page errors. With a PNG per game in the output folder.
- The `shell` suite mounts each template game at 390 and 1440, checks no sideways scroll and no errors, and taps the stage once to prove the loop responds.

Not covered by these checks: Safari, iPhone full screen, sound, real phones, and the look. Look at the screenshots at 1440 and 390 before merging.

## Remove a throwaway game

```
npm run new-game -- <slug> --remove
```

Deletes the folders and every line tagged `gen:<slug>`, and drops the game from the check list and `package.json`. Use this for test games. Run `git diff` afterwards; only the template's own changes should remain.

## Rules when you change a generated game

- Balance changes (costs, rates, unlocks, caps, prestige, offline) get a file in `docs/rule-changes/` in the same PR.
- Keep the engine pure. It must run under `node --experimental-strip-types` with no `@/` imports, so the tests stay fast.
- Keep the panel on the shell's hooks: `useGameShell()` for pause, the `gs-` classes for the frame, the save helpers in `lib/games/save.ts`.
- Each game has its own palette. Do not copy another game's colours.
- Do not put Nate's content, art or audio in the template. Games need their own name, theme and art.

## What the template does not do yet

- Kit UI: the panel uses the kit hooks (clock, autosave, toasts) and its own markup. The kit's styled pieces (ToastStack, PressButton, Counter) are not used yet.
- Homepage Play band: the homepage showcase is a fixed list in `components/home/games-showcase.tsx`, and it needs art. Add a game there only when it has real art.
- Art: the stage uses a plain square. Replace it with the game's own dithered art before a playtest.
