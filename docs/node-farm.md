# Node Farm

An original idle incremental game at `/creations/games/node-farm`, in the Games hub's Incremental section. Theme: you hack
one node from a naOS terminal and grow it into a farm. Saves in the browser (`localStorage` key `nf-save-v1`).

## The chain
Bytes (per second) <- Multipliers <- Reboots <- Copper <- Silicon <- Quartz <- Aether. Every stat except Bytes has six
button tiers (+1, +5, +25, +125, +625, +3125; each tier costs about 8 to 10 times the last, and a button's price grows 9 to 12 percent each time it is bought).
- Multipliers (paid in Bytes) add straight to Bytes per second.
- Reboots (paid in Multipliers) reset Bytes and Multipliers and make every Multiplier button hit harder.
- Copper, Silicon, Quartz and Aether are producers: their buttons add nodes that mine the stat every second. Copper is paid
  in Bytes, each later material in the one before it. Each material boosts the one below it (Copper boosts Reboot power and
  adds a little to Bytes, Silicon boosts Copper, Quartz boosts Silicon, Aether boosts Quartz).
- Ascend (400 Aether): wipes everything except goals, perks and lifetime stats for Ascension Points (+25 percent to everything each) and five perks.
- There is no tapping: progress comes from buttons only (Nate did not want a Cookie Clicker). The core is a live display: its outer arc shows progress to the cheapest Reboot and it pulses on every press. An intrusion appears every 55 to 110 s; catching it gives a x6 Overclock for 20 s.
- Offline progress is capped at 8 hours (Standby cells perk: +4 h per level). Nothing is auto-bought.

## Files
- `lib/nodefarm/engine.ts`: pure rules and every tuning number (`TUNE`). No imports, so the sim runs it in Node.
- `scripts/nodefarm/sim.mjs`: greedy-bot pacing sim. `node --experimental-strip-types scripts/nodefarm/sim.mjs 400`. Last run: first Reboot at 6.6 min, Copper at 1.1 h, Silicon 1.9 h, Quartz 8 h, Aether 75 h, Ascend at 111 h of non-stop play. A casual player is two to three times slower, so about two weeks. Change `TUNE`, re-run, compare.
- `components/nodefarm/`: `node-farm.tsx` (game loop at 10 Hz on real elapsed time, UI), `core.tsx` (144 px canvas shown pixelated), `icon.tsx`.
- `app/camino/nodefarm.css`: all styles, scoped under `.ctos .nf`. This is the only naOS surface that uses more than the cyan accent; each stat has its own colour (`--c`).
- `scripts/naos-art/nodefarm-icons.py`: draws the 11 colour 32 px icons (`public/naos/nodefarm/icons.{png,webp}`). Cell order is shared with `components/nodefarm/icon.tsx`.
- Sounds: the `nf*` entries in `lib/sound/sounds.ts` (naOS blips and scans, rate-limited, off until the first click or key press).

## Gotchas
- Always put `font` rules for buttons through `:where(button)` (the reset is), or element selectors beat the class rules.
- Playwright cannot click the pulsing intrusion button without `force: true` (it never settles, on purpose).
- Intrusions only spawn once Multipliers plus Reboots reach 5, so a brand-new player is not interrupted.
