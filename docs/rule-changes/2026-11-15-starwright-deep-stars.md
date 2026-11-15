# Starwright: deep stars, an endless stardust sink
Date: 2026-11-15 (code merged earlier the same day; listed here by the backlog worker, PR in this thread)
Where: `lib/starwright/data.ts` `TUNE.deepCost`, `deepGrow`, `deepBonus`; `engine.ts` `buyDeep`
Old -> new: none -> first costs 600 stardust, each costs x1.4 more, each adds +4% to everything, cleared by a neutron star
Why: Stardust had nothing to buy once the 20-star map was lit.
Effect on pacing: not re-measured here; `scripts/starwright/sim.mjs` covers the first runs.
Nate has not signed off on these numbers; he can ask to revert any of them.
