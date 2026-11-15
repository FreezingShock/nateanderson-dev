# Groundbreak: stronger Incorporate

- Files: `lib/groundbreak/data.ts` (`TUNE.charterDiv`, perk `o1`), `tests/groundbreak/engine.test.mjs`.
- `TUNE.charterDiv` 10 to 4 (charter = floor(sqrt(rep earned this firm / charterDiv)); a firm-1 run of about 3600 rep pays 30 instead of 19).
- Perk `o1` Standing crews: all crews 1.5x to 2x (cost still 1). Stacks with `o5` and `o7`, so a full ops branch is 12x instead of 9x.
- Why: the second firm was only about 25% faster than the first. Bot run (`GB_INC=1 node --experimental-strip-types --no-warnings scripts/groundbreak/sim.mjs 7`, greedy bot, cheapest perks first): firm 1 172 min (unchanged), firm 2 129 min to 102 min (25% to 41% faster), firm 3 116 min to 95 min (45% faster than firm 1). Target was 35% faster for firm 2 and about 90 min by firm 3.
- Not changed: first-firm pacing, perk costs, city bonuses. Nate's playthrough can retune.
