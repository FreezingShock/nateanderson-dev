# Brasswork: backlog

Audited 2026-11-15 against `integration` at 5138bb6. A fresh thread takes the top open item from section 1, ships it as one PR into `integration`, deletes the item here, and updates the matching row in [FEATURES.md](FEATURES.md). Workflow rules are in `docs/WORKFLOW.md`. Items marked **needs screenshots** follow the project rule: PNG at 1440 and 390 wide, saved in `/mnt/project-files/portfolio/automation-game/`.

Do not start anything in sections 2 or 3 without Nate's words in the thread.

## 1. A thread can just do these

Ordered by value. Each is one PR.

**B-03 Verify the hub delivery light column**
- PR #541 added a delivery shimmer from the life glow pool (`render/life/`). Never seen on screen. Use bench flag `delivery=1|once` on `/dev/voxel-island` under `next dev`.
- Done when: a screenshot shows the column on a delivery at day and at night, it respects Low fx and reduce motion, and the frame time does not rise. **Needs screenshots.**
- 2026-11-15 attempt (`scripts/automation/delivery-light.mjs`): in headless Chrome with software WebGL (about 5 frames a second) the column and glints were not visible at day or night, and Low fx correctly shows none. This does not prove the effect is missing; software rendering outruns the 1 s particle life. Needs a real GPU: Nate's P-05 playtest, or a thread with one. Frame time was not measurable for the same reason.

**B-10 Phone sheets: groups and open/close animation**
- Tap targets are done (every interactive element at 390 wide is 44 px or more, `scripts/automation/tap-targets.mjs`). What is left: the phone sheet groups and open and close animation (`phone-menu-art.css`, `automation-hud.tsx`) should match the desktop `MenuWindow` variants (iris, shutter, settle).
- Done when: Machines, Milestones, Research and More sheets open and close with a drawn animation like the desktop windows, with 390 screenshots of the open and closing frames. **Needs screenshots.**

**B-05 Full-run pacing bot**
- Add `scripts/automation/pacing-bot.mjs`: a headless player on `DEFAULT_CATALOG` that places drills, kilns and windmills from `suggestSpot`/`autoRoute`, buys research, delivers milestones, and prestiges once. Print simulated time to each milestone, first Sky orrery light, and prestige.
- Done when: it finishes without a soft-lock, prints the times, and a short test asserts every milestone is reachable. Write the times in `FEATURES.md`. This does not judge the pacing; Nate's playtest does (P-01).

**B-06 Copy and paste of building areas**
- Not built. Drag a rectangle with a modifier (suggest Ctrl/Cmd+C after a Shift-drag select), then a paste ghost that keeps rotation and belt links, placed with one click, one undo for the whole paste. Only machines and belts the player can afford and has unlocked are pasted, the rest are skipped and counted in the tool hint.
- Code: `input/build.ts` (stroke and ghost), `input/keys.ts`, `input/pointer.ts`, `sim/grid.ts` (`gridView`).
- Done when: unit tests in `tests/automation/input.test.mjs` cover copy, rotate-then-paste, blocked cells, unaffordable parts and undo; a screenshot shows the paste ghost. **Needs screenshots.**

**B-08 Expedition menu pass**
- Same standard as B-07 for `expedition-window.tsx` and `prestige-screen.tsx`: art first, one line of text, ore dots with names in tooltips, hold to confirm. Wait for T-01 if Nate wants the big view instead.
- Done when: all four sites render with their art, hold to confirm works with keyboard and touch, screenshots. **Needs screenshots.**


**Performance audit 2026-11-15** (report: `/mnt/project-files/portfolio/perf-audit-2026-11-15/brasswork.md`, bench: `scripts/automation/perf-sim.mjs`)
- [ ] PERF-drawcalls | size L | A 141-building factory draws about 450 calls a frame (about 350 at the phone's quality level), 605 vertex arrays live. Merge each machine's static voxel parts into one mesh per model and instance repeats, or batch belts. Done when a dense factory is under 150 calls and the look is pixel-identical in the screenshot diff | `render/models.ts`, `render/index.ts`
- [ ] PERF-catchup-cost | size M | The 8 h catch-up still costs about 3.4 s of CPU on a dense factory (about 24 s until playable on a 4x-throttled phone). It no longer freezes the page, but it delays play. Options: coarser steps after the first 5 min (`catchUp()` exists but uses the same 1 s step; a coarser step changes results, so ASK Nate), or run it in a Worker | `components/brasswork/brasswork-host.tsx`, `sim/world.ts`
- [ ] PERF-gl-resources | size S | After 150 place and remove cycles the GL buffers rose by 16 and vertex arrays by 4. Check that `removeObject` disposes geometry; done when the counts return to baseline (harness: `play.cjs` in the audit folder) | `render/models.ts`
- [ ] PERF-device | size S | ASK P-05: frame time on a real GPU and phone. Headless numbers only count calls and JS time, they cannot show fps

## 2. Needs Nate's taste call

Post these as decision cards with a recommendation, one stack, then build the pick.

| Id | Question | Recommendation |
|---|---|---|
| T-01 | Expedition: site cards (today) or a big view of the islands | Keep cards, add a large preview of the hovered site |
| T-02 | Production stats: ledger (today) or two columns (made and used) | Ledger with a toggle for per-minute |
| T-03 | Settings: grouped list (today) or tiles | Grouped list; tiles only for lighting and sound mix |
| T-04 | Machine detail: card beside the machine or a window | Card beside the machine on desktop, sheet on phone |
| T-05 | Phone touch bar: which buttons stay | Top, Rotate, Undo, Remove, Cancel; move Redo into long-press on Undo |
| T-06 | Goals for the second workshop (what is different after "Open a new workshop"): today a site bonus and a kit, then the same five milestones and commissions | Per-site commissions that need that site's ore. Do not invent content before Nate picks |
| T-07 | Island size and a second island as a prestige site (parked) | Leave parked |

## 3. Needs Nate's own playtest or device

| Id | What | How |
|---|---|---|
| P-01 | Pacing of a full run (opening about 1 to 2 minutes, milestones, first light, prestige) | Play it, tell the thread which stretch drags. Compare with B-05 numbers |
| P-02 | Sound: ambient, effects, volumes (`lib/automation/audio/`) | Play with sound on, headphones and phone speaker |
| P-03 | Real phone: touch bar, long-press, bottom sheets, safe areas | `http://192.168.1.216:3000/creations/games/brasswork` while `npm run dev` runs |
| P-04 | Safari desktop and iPhone | Same page |
| P-05 | Motion and frame rate on a real GPU, Low fx and Simple visuals | Open the Settings window and compare |
| P-06 | The live site (the gate returns 401 to threads) | Check the page loads after the next deploy |

### Rule changes made by threads that Nate has not been shown

Read these and say which to keep: higher logistics tiers cost only their extra items; the start stock is 80 iron plates; windmills give 50 kW over 8 cells; unused power is shared across the network; the unloader has an item filter; research is enforced (recipes need their node); milestones pay 12, 30, 30, 44 and 40 blueprints; logistics, crates and docks cost iron plates, gears, copper wire and steel only; iron rod craft is 2 s; drills work on a node under any of their four cells; supply crates, commissions, mastery research and a new-workshop kit were added in #510.

## Parked

Floors above ground level, photo mode, panel folding, a second island as a site. Nate said "later" or did not pick.
