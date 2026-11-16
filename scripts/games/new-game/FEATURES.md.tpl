# __NAME__ features

What exists now. One line per feature. Update the line when the behaviour changes.

## Loop
- Gather: tap the square (or press Space) to gather __RESOURCE__. `tap` in `lib/__SLUG__/engine.ts`, `components/__SLUG__/__CAMEL__.tsx`.
- Generators: three tiers in `GENERATORS`. Each copy costs more than the last, and each gathers per second. Buy with the row or keys 1 to 3. `buyGenerator`, `generatorCost`, `rate`.
- Upgrades: one-time purchases in `UPGRADES`. Each doubles all production. `buyUpgrade`, `multiplier`.
- Offline progress: generators keep gathering while the page is closed, up to 8 hours (`OFFLINE_CAP_SECONDS`). `advance`. A welcome-back line shows the amount.
- Big numbers: `formatAmount` shows 999, then 1.50K, 42.0M and so on.

## Reset
- Prestige: a reset needs `PRESTIGE_UNIT` gathered this run and pays the square root of that in points. Each point adds 10% production for good. Asks twice before it runs. `prestigeGain`, `prestige`.
- Reset keeps points, resets and lifetime taps. Everything else starts over.

## Pause and saves
- Pause: the shell's Pause stops play and the save clock, so paused time never pays out. Hidden tabs count as paused.
- Shell footer: Export save and Import save, checked by `checkSaveData` in `lib/games/save-slot.ts`.
- Damaged saves are kept under a `:damaged` key instead of being overwritten. `load` in the panel.

## Not built yet
- The real game. The starter loop above only proves the template. See BACKLOG.md.
