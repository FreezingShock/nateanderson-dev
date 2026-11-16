# __NAME__ features

What exists now. One line per feature. Update the line when the behaviour changes.

## Loop
- Gather: tap the square (or press Space) to gather __RESOURCE__. `tap` in `lib/__SLUG__/engine.ts`, `components/__SLUG__/__CAMEL__.tsx`.
- Generators: three tiers in `GENERATORS`. Each tier makes the tier below it, and the bottom tier makes __RESOURCE__. Each copy costs more than the last. Buy with the row or keys 1 to 3. Runs on the kit's `stepChain` and `costAt`.
- Upgrades: one-time purchases in `UPGRADES`, each multiplying all production. `upgradeMult`.
- Offline progress: generators keep producing while the page is closed, up to 8 hours (`OFFLINE_CAP_SECONDS`). Long absences are caught up in steps (`catchUp`). A welcome-back line shows the amount.
- Big numbers: the kit's suffix format (`fmt`): 999, 1.23K, 15.0M and so on.

## Reset
- Prestige: a reset needs `PRESTIGE_UNIT` gathered this run and pays the kit's square-root curve in points (`prestigeGain`). Each point adds 10% production for good. A toast confirms the reset. `prestige` keeps taps, points and resets with `resetKeeping`.

## Pause and saves
- Pause: the shell's Pause stops play and the save clock, so paused time never pays out. Hidden tabs count as paused.
- Clock and autosave: the kit's `useGameClock` and `useAutosave`, with a 3-second save interval, on tab hide, and on page leave.
- Shell footer: Export save and Import save, run through `defFor` in `lib/games/save-slot.ts` (the engine's `SAVE_DEF`).
- Saves go through `lib/saves/core` (`loadSave`, `writeSave`). A damaged save is kept under `-corrupt`, and never silently dropped. A toast tells the player when a save was lost.

## Not built yet
- The real game. The starter loop above only proves the template. See BACKLOG.md.
