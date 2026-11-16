# Brasswork: backlog

Audited 2026-11-15 against `integration` at 5138bb6. A fresh thread takes the top open item from section 1, ships it as one PR into `integration`, deletes the item here, and updates the matching row in [FEATURES.md](FEATURES.md). Workflow rules are in `docs/WORKFLOW.md`. Items marked **needs screenshots** follow the project rule: PNG at 1440 and 390 wide, saved in `/mnt/project-files/portfolio/automation-game/`.

Do not start anything in sections 2 or 3 without Nate's words in the thread.

## 1. A thread can just do these

Ordered by value. Each is one PR.

**B-03 Verify the hub delivery light column**
- PR #541 added a delivery shimmer from the life glow pool (`render/life/`). Never seen on screen. Use bench flag `delivery=1|once` on `/dev/voxel-island` under `next dev`.
- Done when: a screenshot shows the column on a delivery at day and at night, it respects Low fx and reduce motion, and the frame time does not rise. **Needs screenshots.**
- 2026-11-15 attempt (`scripts/automation/delivery-light.mjs`): in headless Chrome with software WebGL (about 5 frames a second) the column and glints were not visible at day or night, and Low fx correctly shows none. This does not prove the effect is missing; software rendering outruns the 1 s particle life. Needs a real GPU: Nate's P-05 playtest, or a thread with one. Frame time was not measurable for the same reason.

**B-05 Full-run pacing bot (the placing half)**
- Done: `scripts/automation/pacing-model.mjs` walks every request and milestone through the recipe tree (soft-lock check: machines open in time, research paid by earlier blueprints; idealised lower-bound times). It does not place anything, so it knows nothing about belts, power, the 18 by 12 plateau or build time. Guarded by `tests/automation/pacing-model.test.mjs`.
- Left: a headless player that actually builds on `DEFAULT_CATALOG`: a drill per node, a producer per recipe on `suggestSpot`, `autoRoute` between producers and consumers and to the hub, windmills within range, buys research, prestiges once, and prints real simulated time to each milestone and the first Sky orrery light. Hard parts: several inputs into one machine without starving it, and fitting the orrery chain on the plateau.
- Done when: it finishes without a soft-lock and prints the times next to the model's lower bounds, which go in `FEATURES.md`. It does not judge the pacing; Nate's playtest does (P-01). Size L.

**Performance audit 2026-11-15** (report: `/mnt/project-files/portfolio/perf-audit-2026-11-15/brasswork.md`, bench: `scripts/automation/perf-sim.mjs`)
- [ ] PERF-drawcalls | size L | A 141-building factory draws about 450 calls a frame (about 350 at the phone's quality level), 605 vertex arrays live. Merge each machine's static voxel parts into one mesh per model and instance repeats, or batch belts. Done when a dense factory is under 150 calls and the look is pixel-identical in the screenshot diff | `render/models.ts`, `render/index.ts`
- [ ] PERF-catchup-cost | size M | The 8 h catch-up still costs about 3.4 s of CPU on a dense factory (about 24 s until playable on a 4x-throttled phone). It no longer freezes the page, but it delays play. Options: coarser steps after the first 5 min (`catchUp()` exists but uses the same 1 s step; a coarser step changes results, so ASK Nate), or run it in a Worker | `components/brasswork/brasswork-host.tsx`, `sim/world.ts`
- [ ] PERF-gl-resources | size S | After 150 place and remove cycles the GL buffers rose by 16 and vertex arrays by 4. Check that `removeObject` disposes geometry; done when the counts return to baseline (harness: `play.cjs` in the audit folder) | `render/models.ts`
- [ ] PERF-device | size S | ASK P-05: frame time on a real GPU and phone. Headless numbers only count calls and JS time, they cannot show fps
- [x] TIP-shared | size M | One brass tooltip for every machine, belt, item, resource, research node, milestone, recipe and control; hover on desktop, tap on phone | `components/brasswork-ui/tip.tsx`, `lib/automation/tips.ts`

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

## Rewards and first minutes (thread "Polish Brasswork rewards and first minutes", 2026-11-15)
- [x] REWARD-moment | size M | Reward card for orders, milestones and commissions with crate icons, count-up, sound hook and tests | this PR
- [x] FIRST-banner | size S | NEXT banner named no kiln recipe and no belts, so a newcomer reached "Deliver 10 ingots" with an idle kiln and nothing connected; it now says both first | this PR
- [x] EMPTY-states | size S | Padlock slots for locked machines, crate scene on an untouched hub order, idle scene in the away report | this PR
- [x] FIRST-kiln-recipe | size S | Nate chose auto-pick: a new kiln starts on Iron ingot (docs/rule-changes/2026-11-15-brasswork-kiln-default-recipe.md) | this PR
- [ ] FIRST-pacing-note | size S | For B-05: in a real click-through the opening has four hand steps after the windmill (recipe, two belt runs, hub). Time the human steps, not only the sim, when the pacing bot lands
- [x] EMPTY-expedition-lock | size S | Expedition cards show a text "Locked" button; a padlock glyph and the missing milestone would match the new locked slots | this PR

## Audit 2026-11-16 (pre-deploy walk of every menu at 1440 and 390)
- [x] AUDIT-prestige-phone-scroll | size S | "Open a new workshop" on a phone scrolled its ore list and bonuses inside the window; now the header is one row with a square close, gauges and lists are sized, and the window fits 390 by 844 with no inner scroll | this PR
- [x] AUDIT-research-phone-top | size S | On a phone the Research window covered the top bar and its title; it now starts under the bar | this PR
- [x] AUDIT-next-marker-check | size S | `next-markers.mjs` expected the hub marker before the first delivery; the banner correctly shows belt and kiln first (since the first-banner change), so the check now marks one delivery first | this PR
- [x] AUDIT-settings-desktop-scroll | size M | At 1440 by 900 the Workshop controls window scrolled inside. Coordinator decided: fit it. Desktop groups now sit in two columns, phones get a tab row | this PR
- [ ] AUDIT-prestige-short-phone | size S | Below about 740 px tall (375 by 667) the Open a new workshop body still scrolls inside the window | `prestige-screen.css`
- [x] PHONE-stage | size L | Phone: the 3D world fills the game screen (it was a 0 px strip under the panel); floating top bar, objective, tabs and bottom sheets; camera pad (joystick, turn, zoom) and one-finger orbit, two-finger pan and pinch | this PR
- [ ] PHONE-check-real | size S | ASK P-03: on a real iPhone, check the full-screen panel with no site bar, that one-finger orbit does not fight the browser, and that the joystick and tool column reach with a thumb | headless screenshots only so far
- [x] PHONE-tap-44 | size S | Phone tap audit (`tap-targets.mjs`) flagged touch bar, camera pad, Tools and resource boxes under 44 px; all now 44 px, audit reports 0 in every phone state | this PR
