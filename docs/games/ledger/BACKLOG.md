# Ledger backlog

Format and rules: `docs/WORKFLOW.md`. A thread takes the top open item in **Now** that is not `ASK`, ships it as one PR into `integration`, marks it `[x]` with ` | #PR`, and updates the matching row in [FEATURES.md](FEATURES.md).

Engine: `lib/ledger/engine.ts` (pure). Save: `lib/ledger/save.ts`, slot `ledger` in `lib/saves/keys.ts`. Page: `app/creations/games/ledger/`. Component: `components/games/ledger.tsx`. Tests: `tests/games/ledger-engine.test.mjs`.

## Now (open, ordered: top is next)
- [ ] LEDGER-share | size S | Shared result card in the empty `#ledger-share-slot` on the result panel. Another branch adds the share button; wire it into that slot, not elsewhere. Done when the shared text matches the result and the slot renders on desktop and phone | `components/games/ledger.tsx`

## Next
- [ ] LEDGER-look-dev | size S | Check the component under `next dev` for React warnings. The production check only sees console errors, not dev-only warnings | `components/games/ledger.tsx`
- [ ] LEDGER-stats-points | size S | Show the points total in the stats panel (points are computed in `scoreRound` but not yet shown anywhere) | `lib/ledger/engine.ts`, `components/games/ledger.tsx`

## Needs Nate (taste calls, playtests, his device)
Post the taste calls as one decision-card stack with a recommendation, then build the pick.

- [ ] ASK LEDGER-name | size S | Rename the game? It ships as "Ledger" (one constant, `lib/ledger/name.ts`). Recommend: keep "Ledger". Other options: "Tape" or "Balance". | taste
- [ ] ASK LEDGER-playtest | size S | Pacing and feel. Try a daily and then three unlimited rounds (about 15 minutes). Check: are the six numbers and the target fair on a phone, does the tape read clearly, and is six entries the right number. | playtest
- [ ] ASK LEDGER-accent | size S | Accent is `#7fd6a4` (paper green-grey, away from Node Farm's `#9be564`). Recommend: keep it. | taste

## Ideas
- [ ] LEDGER-hard-tier | size M | A harder daily tier (targets above 500, or three large numbers). Needs a rule-change note in `docs/rule-changes/` if it changes the daily | `lib/ledger/engine.ts`

## Done (newest appended at the end)
