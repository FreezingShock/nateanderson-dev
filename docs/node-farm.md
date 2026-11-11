# Node Farm

An original idle incremental game at `/creations/games/node-farm`, in the Games hub's Incremental section. Theme: you hack
one node from a naOS terminal and grow it into a farm. Saves in the browser (`localStorage` key `nf-save-v1`).

## The chain
Bytes (per second) <- Multipliers <- Reboots <- Copper <- Silicon <- Quartz <- Aether <- Runes <- Starglass <- Voidsteel <- Chrono. Every stat except Bytes has six
button tiers (+1, +5, +25, +125, +625, +3125; each tier costs about 8 to 10 times the last, and a button's price grows 9 to 12 percent each time it is bought).
- Multipliers (paid in Bytes) add straight to Bytes per second.
- Reboots (paid in Multipliers) reset Bytes and Multipliers and make every Multiplier button hit harder.
- Copper, Silicon, Quartz and Aether are producers: their buttons add nodes that mine the stat every second. Copper is paid
  in Bytes, each later material in the one before it. Each material boosts the one below it (Copper boosts Reboot power and
  adds a little to Bytes, Silicon boosts Copper, Quartz boosts Silicon, Aether boosts Quartz).
- Runes, Starglass, Voidsteel and Chrono are the deep materials (unlock at 150 Aether, 200 Runes, 250 Starglass, 300 Voidsteel; a quarter of that after your first Ascend). Same rules as the others, each boosts the one below, Chrono adds a little to everything. They also add to the AP you earn (`TUNE.apPer`).
- Prestige tree (`TREE` in the engine, `components/nodefarm/tree.tsx`): 18 nodes in three branches (Signal, Forge, Systems), bought with AP, kept through Ascend. `state.tree` holds owned ids; old saves load with an empty tree.
- Ascend (400 Aether): wipes everything except goals, perks and lifetime stats for Ascension Points (+25 percent to everything each) and five perks.
- There is no tapping: progress comes from buttons only (Nate did not want a Cookie Clicker). The core is a live display: its outer arc shows progress to the cheapest Reboot and it pulses on every press. An intrusion appears every 55 to 110 s; catching it gives a x6 Overclock for 20 s.
- Offline progress is capped at 8 hours (Standby cells perk: +4 h per level). Nothing is auto-bought. Returning after more than a minute away opens a full-screen standby report (components/nodefarm/away.tsx): time banked, a standby-window meter, what each resource gained, and a Collect button. Everything is already banked when it opens; Esc or Collect closes it.

## Files
- `lib/nodefarm/engine.ts`: pure rules and every tuning number (`TUNE`). No imports, so the sim runs it in Node.
- `scripts/nodefarm/sim.mjs`: greedy-bot pacing sim. `node --experimental-strip-types scripts/nodefarm/sim.mjs 400`. The bot also ascends and buys tree nodes. Last run: first Reboot 0.15 h, Silicon 2 h, Quartz 8 h, Aether 68 h, first Ascend 106 h, Chrono online about 206 h, tree finished about 270 h of non-stop play (Nate wants about 4 weeks casual to the full chain). A casual player is two to three times slower, so about two weeks. Change `TUNE`, re-run, compare.
- `components/nodefarm/`: `node-farm.tsx` (game loop at 10 Hz on real elapsed time, UI), `core.tsx` (144 px canvas shown pixelated), `icon.tsx`.
- `app/camino/nodefarm.css`: all styles, scoped under `.ctos .nf`. This is the only naOS surface that uses more than the cyan accent; each stat has its own colour (`--c`).
- `scripts/naos-art/nodefarm-icons.py`: draws the 15 colour 32 px icons (`public/naos/nodefarm/icons.{png,webp}`). Cell order is shared with `components/nodefarm/icon.tsx`.
- Tier icons: every button tier of Multipliers, Reboots and the eight materials has its own 32 px sprite (`public/naos/nodefarm/tiers.{png,webp}`, 6 rows by 6 columns), drawn by `scripts/naos-art/nodefarm-tier-icons.py` and shown by `NfTierIcon` in `components/nodefarm/icon.tsx`. To give a new stat icons, add a `(canvas, tier)` function to `ROWS` in the script and the same id to `TIER_ROWS` in icon.tsx.
- Core stages (`core.tsx`): hexagon until 4 stats are unlocked, then an octagon with an inner rotor, then an eight-pointed crystal at 6 stats. Layers on top: an orbiting node per unlocked stat past the second, a centre spoke per doubling of Reboots (max 8), and a halo segment per Ascension Point (max 24).
- Sounds: the `nf*` entries in `lib/sound/sounds.ts` (naOS blips and scans, rate-limited, off until the first click or key press). `nfBuy` has a voice per stat (keypad, relay clack, ticks, chime, airy swell); `nfTierUp` plays the first time a tier is bought, `nfDecrypt` when a stat unlocks, `nfAscend` is the long root-access sequence. The reactor hum is `setHum()` in `lib/sound/engine.ts`, driven every game tick; it rises with Bytes/s, pitches up during an Overclock, and has its own Hum switch in the Menu (`nf-hum-v1`).

## Gotchas
- Always put `font` rules for buttons through `:where(button)` (the reset is), or element selectors beat the class rules.
- Playwright cannot click the pulsing intrusion button without `force: true` (it never settles, on purpose).
- Intrusions only spawn once Multipliers plus Reboots reach 5, so a brand-new player is not interrupted.

## Goals, secrets, Records and the console (`nf`)
- Goals: seven tiers of six (Access to Zero). Each done goal or found secret gives +2% to everything, a full tier +8%. `state.achAt` holds when each was done (the log shows it). Tiers 6 and 7 cover the deep materials, the tree and long grinds.
- Secrets (`SECRETS` in engine.ts) show as ???? with a clue. Three are unlocked by hidden console commands (`nf ping 127.0.0.1`, `nf sudo`, `nf whoami`), three by play (3 am session, 24 h played, a full standby report).
- Records window (dock and a phone tab): this run, materials, lifetime, progress. Built in `lib/nodefarm/records.ts` (`recordSections`).
- Console: `nf`, `nf stats`, `nf goals`, `nf secrets`, `nf open`. The console asks the open game for its state with an `nf:live` event (the game fills `detail.live`); with no game open it reads and writes the saved game in localStorage. `nfCommand` is pure, so new commands go in records.ts.
- New life counters (`capped`, `peakBps`, `apTotal`) and `achAt` are filled in for old saves by `parseSave`.

## Drones (automation)
One Drone per button tier (T1 to T6), bought with Aether, up to level 10 (`TUNE.drone`). Each level presses that tier's button 0.25 times a second on every stat the player has armed (Armed switch in each stat zone; Reboots are never automated). Drones reset on Ascend, the armed list is kept. Time away runs them at 50% speed and the standby report shows the Drone presses. The Autoloader perk now covers Multipliers and Copper through Chrono (max 9 levels).
