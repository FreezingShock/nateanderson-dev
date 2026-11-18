# Saves

One save system for every game. Code: `lib/saves/` (core, keys), each game's save definition next to its engine, `lib/games/save.ts` and `lib/games/save-slot.ts` for export and import, `lib/games/guess-stats.ts` for the guessers' streaks.

## What is stored
The live save in the browser is the same envelope a player exports:

    { "app": "groundbreak", "version": 2, "savedAt": "2026-11-16T22:00:00.000Z", "data": { ...the game's plain JSON } }

Keys and versions live in one place, `lib/saves/keys.ts`. Engines import their key from there, so a rename shows in one diff.

| Game | App | Key | Version |
| --- | --- | --- | --- |
| Brasswork | `brasswork` | `brasswork-save-v1` | 1 |
| Starwright | `starwright` | `sw-save-v1` | 1 |
| Groundbreak | `groundbreak` | `gb-save-v1` | 2 |
| Node Farm | `node-farm` | `nf-save-v1` | 1 |
| Ledger | `ledger` | `ledger-save-v1` | 1 |

Node Farm keeps its own backup list (`nf-backups-v1`, lib/nodefarm/backups.ts). Its backups hold the game's bare JSON text, and its own export code is read by `parseSave`, which accepts the envelope and the bare form.

## Old saves still load
Before this system a save was stored bare: the game's own JSON with no envelope (Starwright, Groundbreak, Node Farm), or `{ text, savedAt }` (Brasswork). `loadSave` reads those too. Their version comes from `bareVersion` (the `v` field inside the game's JSON, or 1). Then the game's `migrations` run in order from that version to the current one.

## How a game defines its save
A `SaveDef<T>` in the engine file (see `GROUNDBREAK_SAVE` in `lib/groundbreak/engine.ts`):

- `app`, `key`, `version`: from `lib/saves/keys.ts`.
- `bareVersion(data)`: the version of a save stored without an envelope.
- `migrations[v](data)`: turns version `v` data into version `v + 1`. Keep every migration forever, because old saves stay in browsers.
- `revive(data)`: builds the live state from migrated data. Return null for a save that is not usable.
- `dump(state)`: the plain JSON to store.
- `fallbacks`: rolling copies, newest first, tried when the live save is damaged.

Then the game calls `loadSave(localStorage, DEF)` on boot and `writeSave(localStorage, DEF, state)` on each save. `writeSave` returns the stored text, or null when the browser refuses.

## Damage and recovery
- A save that will not parse, migrate or revive is never dropped. Its text is copied to `<key>-corrupt` (an older different copy moves to `-corrupt-prev`).
- Then each fallback is tried in order. If one loads, the result is `restored` and the game shows its note.
- A save from a newer version of the game is refused the same way. The load never overwrites it.
- If nothing loads, the result is `lost` and a new game starts. The damaged text stays under `-corrupt`.

## Export and import
- Export writes the envelope at the current version, after running the migrations (`exportSave` in `lib/games/save-slot.ts`).
- Import checks the file (app, version, size), runs the same migrate-and-revive on it, keeps the current save under `<key>:before-import`, and stages the file in sessionStorage. The page reloads, `applyPendingImports()` writes it to the key before any game reads, and the load migrates it.
- A file from an older version is accepted when it migrates and revives. A file from a newer version is refused.

## The save loop belongs to the kit
The game kit thread owns when a save happens (interval, pagehide, one tab at a time). It calls each game's existing `save()` function. A game's `save()` keeps its name and calls `writeSave`. Do not put save timing in `lib/saves`.

## Adding a migration
1. Bump the version in `lib/saves/keys.ts`.
2. Add `migrations[oldVersion]` to the game's `SaveDef`. It must be a pure function of plain data.
3. Add a test to `tests/saves/saves.test.mjs` that loads a real save of the old shape (copy it into `tests/saves/fixtures/`, not from memory).
4. If the change moves numbers, log it under `docs/rule-changes/`.

## Tests
`npm run test:nodefarm` runs `tests/saves/saves.test.mjs` with the engine suites. It covers the late-game and mid-game Groundbreak seeds, migrations in order, newer and damaged saves, Starwright, Brasswork's `{ text, savedAt }`, Node Farm's envelope and bare text, and guesser streaks from before the envelope.

Not covered by node tests: the export and import buttons in the browser (`lib/games/save-slot.ts` imports the `@/` alias and the shell), and the Groundbreak and Starwright menus. Check those in the browser on a production build before a deploy.
