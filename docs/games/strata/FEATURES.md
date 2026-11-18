# Strata features

Strata is a daily word puzzle in the Puzzle section of the Games hub. Working title: the name lives in one constant, `STRATA_NAME` in `components/games/strata.tsx`.

## Play
- Daily word: one five-letter word for everyone, new at midnight Pacific. Puzzle number is days since `STRATA_EPOCH` (lib/strata/engine.ts) plus one. Route `/creations/games/strata`.
- Unlimited: random words, open after one finished daily on this device (same unlock as the guessers). `New word` starts the next round.
- Six tries. Each tile is marked correct (solid, corner square), wrong place (hatched outline) or not in the word (lowercase, slashed). Repeated letters are scored by matching each copy once.
- On-screen keyboard keys show the best mark each letter has earned. Physical keyboard: letters, Backspace, Enter.
- Invalid guesses (short, non-letter, not on the list, already tried) show a message in a polite live region and shake the row.
- Reload mid-round restores both rounds and the open mode (`strata-save-v1`, lib/strata/save.ts).
- Stats (played, win %, streak, best, distribution) and the Unlimited unlock use `useGuessProgress` from the guess kit, stored under `strata-stats-v1` and `strata-unlimited-unlocked-v1`.

## Words
- lib/strata/words.ts: `ANSWERS` (822 common everyday words, written for this game) and `GUESS_ONLY`; `ALLOWED` is both (3019 words).
- The daily word is a seeded permutation of `ANSWERS` per cycle: no repeats until the list is used up, and the same on every device.
- Editing `ANSWERS` reshuffles every daily after the epoch. Change it deliberately.

## Look and layout
- Accent: clay `#d9895b` (`--st-accent` in app/camino/strata.css). Not Groundbreak's amber.
- Tiles are square and fill a 340px board; the keyboard keys are at least 44px tall. Checked at 1440 and 390 wide.
- Motion: tile flip and row shake use the camino tokens; both are off under reduced motion.
- A reserved, empty share slot (`data-slot="share"`) sits on the result screen for the share action.

## Files
- lib/strata/engine.ts: scoring, daily and random words, keyboard state, outcome (pure).
- lib/strata/words.ts: word lists. lib/strata/save.ts: the live-round save definition.
- components/games/strata.tsx: board, keyboard, results, stats. app/camino/strata.css: styles.
- app/creations/games/strata/page.tsx: route. lib/creations-data.ts: the Puzzle section card.
- Tests: tests/games/strata-engine.test.mjs, strata-words.test.mjs, strata-save.test.mjs.
