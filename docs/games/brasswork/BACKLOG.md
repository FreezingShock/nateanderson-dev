# Brasswork: backlog

Audited 2026-11-15 against `integration` at 5138bb6. A fresh thread takes the top open item from section 1, ships it as one PR into `integration`, deletes the item here, and updates the matching row in [FEATURES.md](FEATURES.md). Workflow rules are in `docs/WORKFLOW.md`. Items marked **needs screenshots** follow the project rule: PNG at 1440 and 390 wide, saved in `/mnt/project-files/portfolio/automation-game/`.

Do not start anything in sections 2 or 3 without Nate's words in the thread.

## 1. A thread can just do these

Ordered by value. Each is one PR.

**B-02 Verify the NEXT markers on screen**
- The windmill and hub markers (`brasswork-host.tsx` `syncTarget`, `components/brasswork/next-marker.tsx`) were never looked at. Play the opening with `?bwdev=1`, screenshot the drill, kiln, windmill and hub steps at 1440 and 390.
- Done when: each marker sits on the cell it names (kiln and windmill on `suggestSpot`, hub on its 3x3), does not cover the menu, and disappears when the step is done. Fix what is wrong. **Needs screenshots.**

**B-03 Verify the hub delivery light column**
- PR #541 added a delivery shimmer from the life glow pool (`render/life/`). Never seen on screen. Use bench flag `delivery=1|once` on `/dev/voxel-island` under `next dev`.
- Done when: a screenshot shows the column on a delivery at day and at night, it respects Low fx and reduce motion, and the frame time does not rise. **Needs screenshots.**

**B-04 Verify hover names on tiles and machines**
- PR #545 added `components/brasswork/hover-name.tsx`. Check it on build tiles, resource boxes and machines on the island, at 1440 and on touch (no stuck labels).
- Done when: the name shows within about 150 ms, never covers the cursor target, and clears on leave. **Needs screenshots.**

**B-11 Bursts respect Simple visuals**
- Place, remove, milestone, research and unlock bursts (`render/effects.ts`, `render/life/index.ts`) still spawn under the Simple visuals setting. Life bursts already skip under `lowFx`.
- Done when: with Simple visuals or `data-lowfx="true"` no particle pool is touched, and the effects still show with it off.

**B-14 Machines panel covers the iron node on desktop**
- At the opening view the Machines panel sits over the iron node, so the first drill spot is hidden. Look at the opening camera in `brasswork-host.tsx` and the insets in `.ab-root` (`desktop-stage.css`).
- Done when: at 1440x900 and 1280x720 the first drill target and its NEXT marker are visible with the build dock open. **Needs screenshots.**

**B-10 Phone: 44 px touch buttons and sheet groups**
- The touch bar (`input/touch-bar.ts`) uses 48 px buttons per STATUS; other taps (build tiles, sheet rows, close buttons) were never measured. Measure them, raise every tap target on coarse pointers to at least 44 px, keep touch buttons off the play field (the 56 px strip under the stage).
- Also: the phone sheet groups and open and close animation (`phone-menu-art.css`, `automation-hud.tsx`) should match the desktop `MenuWindow` variants.
- Done when: a Playwright pass at 390x844 with touch emulation finds no interactive element under 44 px and the sheets animate. **Needs screenshots.**

**B-05 Full-run pacing bot**
- Add `scripts/automation/pacing-bot.mjs`: a headless player on `DEFAULT_CATALOG` that places drills, kilns and windmills from `suggestSpot`/`autoRoute`, buys research, delivers milestones, and prestiges once. Print simulated time to each milestone, first Sky orrery light, and prestige.
- Done when: it finishes without a soft-lock, prints the times, and a short test asserts every milestone is reachable. Write the times in `FEATURES.md`. This does not judge the pacing; Nate's playtest does (P-01).

**B-06 Copy and paste of building areas**
- Not built. Drag a rectangle with a modifier (suggest Ctrl/Cmd+C after a Shift-drag select), then a paste ghost that keeps rotation and belt links, placed with one click, one undo for the whole paste. Only machines and belts the player can afford and has unlocked are pasted, the rest are skipped and counted in the tool hint.
- Code: `input/build.ts` (stroke and ghost), `input/keys.ts`, `input/pointer.ts`, `sim/grid.ts` (`gridView`).
- Done when: unit tests in `tests/automation/input.test.mjs` cover copy, rotate-then-paste, blocked cells, unaffordable parts and undo; a screenshot shows the paste ghost. **Needs screenshots.**

**B-07 Research menu pass**
- Nate's brief: pop-up beside the clicked card, alternates mixed into the tree in different colours, art edge to edge with a panel colour per state (`research-screen.tsx`, `research-screen.css`). Today the pop-up and alternate colouring still need a clean pass, and the six Mastery cards need checking next to the core tree.
- Done when: one section open at a time, every card has art and a name tooltip, keyboard focus works, no React warnings in the console, 1440 and 390 screenshots. **Needs screenshots.**

**B-08 Expedition menu pass**
- Same standard as B-07 for `expedition-window.tsx` and `prestige-screen.tsx`: art first, one line of text, ore dots with names in tooltips, hold to confirm. Wait for T-01 if Nate wants the big view instead.
- Done when: all four sites render with their art, hold to confirm works with keyboard and touch, screenshots. **Needs screenshots.**

**B-16 Test the HUD data and the save format against a golden file**
- No test covers `hudData` output shape or a save round trip across versions. Add a golden `serialize` fixture so a future change to `World` that breaks old saves fails a test.
- Done when: `npm run test:automation` loads a checked-in v1 save and keeps playing it for 60 simulated seconds.

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
