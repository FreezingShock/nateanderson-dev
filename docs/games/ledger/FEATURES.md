# Ledger: features

Route `/creations/games/ledger`. Update the row when a PR changes a feature. Open work lives in [BACKLOG.md](BACKLOG.md). Workflow rules live in `docs/WORKFLOW.md`.

**States:** `working` = built, merged, covered by a test or checked in a browser. `partial` = exists with a known gap. `untested` = built, not verified on a real device.

**Test commands:** `npm run test:nodefarm` runs the engine suite (`tests/games/ledger-engine.test.mjs`). The browser run (daily win, daily loss, Unlimited, reload mid-round, phone and desktop) is not a repo script yet; it ran once by hand against `next start` on a production build.

## Rules and engine

- Puzzle: six whole numbers (four 1 to 10, two of 25, 50, 75, 100) and a target 101 to 999. `lib/ledger/engine.ts` `generate`. Working: `working`
- Every puzzle is solvable exactly. The generator draws numbers and a target from a seeded PRNG and rejects any target that the solver cannot reach. The solver is a subset search (`buildTable`, `findSolution`). Working: `working`, tested on all 365 days from the epoch
- Legal steps: + - x /, division only when exact, every result a positive whole number, each given number used at most once. Illegal steps say why in words (`applyStep`). Working: `working`
- Six submissions per round. Each reports how far off it is; the best so far is shown. Exact wins; six misses lose and show one way to make the target. Working: `working`
- Scoring: a win scores 60 on the first entry down to 10 on the sixth; a loss scores 0 (`scoreRound`). Not yet shown on screen. Partial (see backlog LEDGER-stats-points)
- Daily: the same puzzle for everyone, changing at midnight Pacific. Puzzle number `#1` is the epoch day `LEDGER_EPOCH` (2026-11-17). Working: `working`
- Unlimited: a random puzzle, unlocked once a daily is finished on the device (`useGuessProgress`, the same unlock as the guessers). Working: `working`

## Input

- Touch: tap a number, tap an operator, tap a second number. The result prints on the tape. Undo, Clear, Submit. Working: `working` (headless, 390 wide)
- Keyboard: 1 to 6 pick the tile in that position, + - x / pick the operator, Enter submits, Backspace undoes, Escape clears. Working: `working` (headless, 1440 wide)
- Refused moves show the reason in the status line (`role="status"`, polite). Working: `working`

## Saves and stats

- In-progress round for today's daily and for Unlimited is stored in `ledger-save-v1` (`lib/ledger/save.ts`), so a reload mid-round restores the tape. A finished daily stays on the result after a reload. Working: `working`
- Streaks and the guess distribution are stored under `ledger-stats-v1`. The Unlimited unlock is `ledger-unlimited-unlocked-v1`. Working: `working`
- A damaged save is kept (`-corrupt`) and never wiped, through `lib/saves/core`. Working: `working` (the save path is shared with the other games; no Ledger-specific damage test yet). Partial

## Screen

- Daily and Unlimited tabs (`components/games/mode-tabs.tsx`). Working: `working`
- Tape, six tiles, four operators, status line, six entries, result panel with the worked answer. Working: `working` (checked at 1440 and 390, no sideways scroll, controls at least 44px)
- Share slot: an empty `#ledger-share-slot` on the result panel, waiting for the shared-card branch. Not built. Partial (see backlog LEDGER-share)
- Reduced motion: transitions are removed (`prefers-reduced-motion`). Working: `untested` on a real device
- Accent `#7fd6a4` (paper green-grey). Untested on a real screen by Nate.

## Hub

- Card in the Puzzle section of the Games hub, above the number-card marker in `lib/creations-data.ts`. Card shot `public/games/shots/ledger.webp` (960 by 600, 20 KB). Working: `working`
