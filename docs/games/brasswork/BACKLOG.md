# Brasswork backlog

Format and rules: `docs/WORKFLOW.md`. Consolidated 2026-11-16 into the standard sections. Wording is kept; a few long lines were shortened, and no item was dropped. A thread takes the top open item in **Now** that is not `ASK`, ships it as one PR into `integration`, marks it `[x]` with ` | #PR`, and updates the matching row in [FEATURES.md](FEATURES.md). Items that need screenshots follow the project rule: PNG at 1440 and 390 wide, saved in `/mnt/project-files/portfolio/automation-game/`.

Architecture and checks: `docs/ARCHITECTURE.md`. Balance changes: `docs/rule-changes/`. Do not start anything marked `ASK` without Nate's words in the thread.

## Now (open, ordered: top is next)
- [ ] B-03 | size S | Verify the hub delivery light column. PR #541 added a delivery shimmer from the life glow pool (`render/life/`), never seen on screen. Use bench flag `delivery=1|once` on `/dev/voxel-island` under `next dev`. Done when a screenshot shows the column on a delivery at day and at night, it respects Low fx and reduce motion, and frame time does not rise. Needs screenshots. 2026-11-15 attempt (`scripts/automation/delivery-light.mjs`): in headless Chrome with software WebGL (about 5 fps) the column was not visible at day or night, and Low fx correctly shows none; that does not prove the effect is missing, so it needs a real GPU (see P-05) | `render/life/`
- [ ] B-05 | size L | Full-run pacing bot, the placing half. Done already: `scripts/automation/pacing-model.mjs` walks every request and milestone through the recipe tree (soft-lock check, idealised lower-bound times), guarded by `tests/automation/pacing-model.test.mjs`. Left: a headless player that builds on `DEFAULT_CATALOG` (a drill per node, a producer per recipe on `suggestSpot`, `autoRoute` to consumers and the hub, windmills in range, research, one prestige) and prints simulated time to each milestone and the first Sky orrery light. Done when it finishes without a soft-lock and prints times next to the model's lower bounds, which go in `FEATURES.md`. It does not judge pacing; P-01 does | `scripts/automation/`
- [ ] PERF-drawcalls | size L | A 141-building factory draws about 450 calls a frame (about 350 at phone quality), 605 vertex arrays live. Merge each machine's static voxel parts into one mesh per model and instance repeats, or batch belts. Done when a dense factory is under 150 calls and the look is pixel-identical in the screenshot diff. Report: `/mnt/project-files/portfolio/perf-audit-2026-11-15/brasswork.md`, bench `scripts/automation/perf-sim.mjs` | `render/models.ts`, `render/index.ts`
- [ ] PERF-catchup-cost | size M | The 8 h catch-up still costs about 3.4 s of CPU on a dense factory (about 24 s until playable on a 4x-throttled phone). Options: coarser steps after the first 5 min (`catchUp()` uses the same 1 s step; a coarser step changes results, so ASK Nate first), or run it in a Worker | `components/brasswork/brasswork-host.tsx`, `sim/world.ts`
- [ ] PERF-gl-resources | size S | After 150 place and remove cycles GL buffers rose by 16 and vertex arrays by 4. Check that `removeObject` disposes geometry; done when counts return to baseline (harness `play.cjs` in the audit folder) | `render/models.ts`
- [ ] FIRST-pacing-note | size S | For B-05: in a real click-through the opening has four hand steps after the windmill (recipe, two belt runs, hub). Time the human steps, not only the sim, when the pacing bot lands | `components/automation/`
- [ ] AUDIT-prestige-short-phone | size S | Below about 740 px tall (375 by 667) the Open a new workshop body still scrolls inside the window | `prestige-screen.css`

## Next
(none open)

## Needs Nate (taste calls, playtests, his device)
Post the taste calls as one decision-card stack with a recommendation, then build the pick.

- [ ] ASK T-01 | size S | Expedition: site cards (today) or a big view of the islands. Recommend: keep cards, add a large preview of the hovered site | taste
- [ ] ASK T-02 | size S | Production stats: ledger (today) or two columns (made and used). Recommend: ledger with a toggle for per-minute | taste
- [ ] ASK T-03 | size S | Settings: grouped list (today) or tiles. Recommend: grouped list; tiles only for lighting and sound mix | taste
- [ ] ASK T-04 | size S | Machine detail: card beside the machine or a window. Recommend: card beside the machine on desktop, sheet on phone | taste
- [ ] ASK T-05 | size S | Phone touch bar: which buttons stay. Recommend: Top, Rotate, Undo, Remove, Cancel; move Redo into long-press on Undo | taste
- [ ] ASK T-06 | size M | Goals for the second workshop (what is different after "Open a new workshop"; today a site bonus and a kit, then the same five milestones and commissions). Recommend: per-site commissions that need that site's ore. Do not invent content before Nate picks | taste
- [ ] ASK T-07 | size S | Island size and a second island as a prestige site (parked). Recommend: leave parked | taste
- [ ] ASK PHONE-check-real | size S | P-03: on a real iPhone, check the full-screen panel with no site bar, that one-finger orbit does not fight the browser, and that the joystick and tool column reach with a thumb. Headless screenshots only so far | device
- [ ] ASK PERF-device | size S | P-05: frame time on a real GPU and phone. Headless numbers count calls and JS time only; they cannot show fps | device
- [ ] ASK SWEEP-world-verdigris | size M | In-world verdigris (`#58b09a` in the model palettes, and the green-leaning `patina` ramp) still reads teal on machine roofs, belts, resource nodes and machine icon halos. Nate's rule says no teal, but the change touches every model, so it needs his call on the exact colour | `lib/automation/models/*/palette.ts`, `scripts/brasswork/bw_palette.py`, `scripts/brasswork/build-menu-art.py`
- [ ] ASK P-01 | size M | Pacing of a full run (opening about 1 to 2 minutes, milestones, first light, prestige). Play it, tell the thread which stretch drags, and compare with B-05 numbers | playtest
- [ ] ASK P-02 | size S | Sound: ambient, effects, volumes (`lib/automation/audio/`). Play with sound on, headphones and phone speaker | playtest
- [ ] ASK P-03 | size S | Real phone: touch bar, long-press, bottom sheets, safe areas at `http://192.168.1.216:3000/creations/games/brasswork` while `npm run dev` runs | device
- [ ] ASK P-04 | size S | Safari desktop and iPhone, same page | device
- [ ] ASK P-05 | size S | Motion and frame rate on a real GPU, Low fx and Simple visuals. Open the Settings window and compare | device
- [ ] ASK P-06 | size S | The live site: the gate returns 401 to threads. Check the page loads after the next deploy | device
- [ ] ASK RULES-review | size S | Rule changes made by threads that Nate has not been shown; each has a file in `docs/rule-changes/`. Higher logistics tiers cost only their extra items; start stock 80 iron plates; windmills give 50 kW over 8 cells; unused power shared across the network; unloader has an item filter; research is enforced; milestones pay 12, 30, 30, 44 and 40 blueprints; logistics, crates and docks cost iron plates, gears, copper wire and steel only; iron rod craft 2 s; drills work under any of their four cells; supply crates, commissions, mastery research and a new-workshop kit added in #510. Read and say which to keep | rule-changes

## Ideas (parked: Nate said "later" or did not pick)
- [ ] ASK PARK-floors | size L | Floors above ground level
- [ ] ASK PARK-photo | size M | Photo mode
- [ ] ASK PARK-panels | size S | Panel folding
- [ ] ASK PARK-island-2 | size L | A second island as a site

## Done (newest appended at the end)
- [x] TIP-shared | size M | One brass tooltip for every machine, belt, item, resource, research node, milestone, recipe and control; hover on desktop, tap on phone | `components/brasswork-ui/tip.tsx`, `lib/automation/tips.ts`
- [x] REWARD-moment | size M | Reward card for orders, milestones and commissions with crate icons, count-up, sound hook and tests | this PR
- [x] FIRST-banner | size S | NEXT banner named no kiln recipe and no belts, so a newcomer reached "Deliver 10 ingots" with an idle kiln and nothing connected; it now says both first | this PR
- [x] EMPTY-states | size S | Padlock slots for locked machines, crate scene on an untouched hub order, idle scene in the away report | this PR
- [x] FIRST-kiln-recipe | size S | Nate chose auto-pick: a new kiln starts on Iron ingot (`docs/rule-changes/2026-11-15-brasswork-kiln-default-recipe.md`) | this PR
- [x] EMPTY-expedition-lock | size S | Expedition cards show a text "Locked" button; a padlock glyph and the missing milestone would match the new locked slots | this PR
- [x] AUDIT-prestige-phone-scroll | size S | "Open a new workshop" on a phone scrolled its ore list and bonuses inside the window; header is one row with a square close, gauges and lists sized, window fits 390 by 844 with no inner scroll | this PR
- [x] AUDIT-research-phone-top | size S | On a phone the Research window covered the top bar and its title; it now starts under the bar | this PR
- [x] AUDIT-next-marker-check | size S | `next-markers.mjs` expected the hub marker before the first delivery; the check now marks one delivery first, matching the banner | this PR
- [x] AUDIT-settings-desktop-scroll | size M | At 1440 by 900 the Workshop controls window scrolled inside. Coordinator decided: fit it. Desktop groups in two columns, phones get a tab row | this PR
- [x] PHONE-stage | size L | Phone: the 3D world fills the game screen (it was a 0 px strip under the panel); floating top bar, objective, tabs and bottom sheets; camera pad (joystick, turn, zoom) and one-finger orbit, two-finger pan and pinch | this PR
- [x] PHONE-tap-44 | size S | Phone tap audit (`tap-targets.mjs`) flagged touch bar, camera pad, Tools and resource boxes under 44 px; all now 44 px, audit reports 0 in every phone state | this PR
- [x] DESK-fit-windows | size M | Desktop windows: Machines locked-row text sits inside its dashed box; NEXT banner steps beside an open flyout and hides under a full window; Settings uses one switch for every on/off and one slider for every range | this PR
- [x] PHONE-next-banner | size S | Phone NEXT banner: text beside its button, about 65 css px tall at 390 (was about 114); milestone stat labels on one line at 375 and 390 | this PR
- [x] PHONE-overlaps-menus | size S | At 390 the More menu ran under the tool column, the Tools and sheet-tab tags covered their menus, and the placement label could sit under the camera pad; menus now clear the column, touch skips tags on tabs, More items and Tools, and the label flips above its marker | this PR
- [x] GROUND-calm-base | size M | Calmer ground (Nate's pick, FINDINGS WS5): one base tone for the plateau and grass on every screen size; Bayer dither only on edges, kiln glow kept | this PR

## Research readability (thread "Make Brasswork research readable", 2026-11-16)
- [x] RESEARCH-names-header | size S | Research node names 12.5 px to 14 px and cards 114 px to 122 px tall so two-line names (Aluminium casings, Quartz-only silicon) no longer clip; header band 66 px to 50 px so the title leads | this PR

## Detail sweep (2026-11-16, thread "Sweep games for inconsistent details")
- [x] SWEEP-research-teal | size S | The research window and two window banners were teal and mint (the accent, tier labels, blueprint count, card edges and the header blueprint strip; the Research and Milestones banners and the Hub banner's roof). They are now brass with a warm olive-bronze patina (`--rs-acc #8f9650`). The in-world verdigris is unchanged (see SWEEP-world-verdigris). | `components/automation/research-screen.css`, `components/brasswork-ui/brass-kit.css`, `scripts/brasswork/build-window-art.py` (`print` and `olive` ramps), `public/brasswork/window/banner-{research,milestones,hub}.png`
- [x] SWEEP-world-verdigris | size M | In-world verdigris (`#58b09a` in the model palettes, and the green-leaning `patina` ramp) read teal on machine roofs, belts, resource nodes, research particles and icon halos. Nate's rule is no teal anywhere, and the coordinator approved the warm olive-bronze patina (`#8f9650`, roofs `#6e6a36`/`#b3b26a`, copper ore `#4e5226`). The sea's default `verdigris` palette is now dark olive-bronze too (the key name stays for `?water=` links). Patina is a fixed real-world tone on the green circuit board (`board`, `#2e5c42`), which is left as is. | `lib/automation/models/*/palette.ts`, `lib/automation/render/{life/index,config,portarrows}.ts`, `scripts/brasswork/bw_palette.py`, `scripts/brasswork/build-menu-art.py`, `public/brasswork/{art,icons}/*`
- [x] SWEEP-more-menu-icons | size S | Phone More menu: the Starter quest scroll was 28 px and pushed its label 2 px out of line with the other rows. It now uses the same 24 px icon as the rest. | `components/automation/automation-hud.tsx`
- [x] SWEEP-prestige-phone | size S | Phone Prestige window: the scrim ignored the HUD bar, so the Tools button sat over the close button; the window now starts below the bar. Site names cut off as "IRON R..." now wrap onto two lines. | `components/automation/prestige-screen.css`

## Review 2026-11-18 (thread "Review and polish Brasswork", phone and desktop headless at 1440 and 390)
- [x] REVIEW-palette-one-group | size S | The phone Machines tab opened with Logistics first and all three groups open, so the machines sat below the fold. One group opens at a time, Machines first; the desktop dock is unchanged | this PR
- [x] REVIEW-settings-short | size S | Settings clipped at 1440 by 900: the game panel is about 500 px tall, and the two-column window had no scroll, so Full numbers and Save were cut off (FEATURES had said it fit). Below a 1200 px viewport height it now uses the phone tab row | this PR
- [ ] REVIEW-plateau-mauve | size M | The factory plateau paints mauve-pink in headless renders (`/mnt/project-files/brasswork-review-2026-11-18/before/open-desk.png`). `TERRAIN_HEX` sets the floor to brown `0x6e5438`, so something after the palette shifts its hue. Suspect: the dither pass applies `pow(c, 1/2.2)` (`render/postfx.ts`) to a target that may already be encoded. Find the cause, then check on a real GPU (P-05) | `render/postfx.ts`, `render/terrain.ts`
- [x] REVIEW-panel-height | size M | Nate chose a taller panel. Brasswork only: the panel gets 385 px of allowance instead of the shell's 400 px (about 30 px more at 1440 by 900). A bigger panel collides with the site dock because the footer sits under the frame, so more room needs the dock hidden on this route, as Groundbreak does. Expedition cards and the Production ledger still run off the bottom at 1440 by 900 | `components/automation/desktop-stage.css` | this PR
- [ ] ASK REVIEW-dock-hide | size M | Only if Nate wants more than about 30 px: hide the site dock on the Brasswork route (as Groundbreak does), so the panel can grow and clear the footer | `app/camino/game-shell.css`, `components/automation/automation-hud.tsx`
- [x] REVIEW-frame-cyan | size S | Nate chose brass. The panel outline (site cyan) is now brass on Brasswork only. The sound "ON" label and top bar are site chrome outside the panel and keep the site cyan | `components/automation/desktop-stage.css` | this PR
- [x] REVIEW-expedition-banner | size S | Nate chose the fade. The bright block at the banner's left edge fades into the dark title band (mask on the Expedition banner only) | `components/automation/expedition-window.css` | this PR
- [x] REVIEW-tabs-look | size S | Nate chose plain tabs. The Settings tab row (phone and short desktop) is text on a hairline, with a brass underline on the picked tab | `components/automation/settings-window.css` | this PR
- [ ] ASK REVIEW-verdigris-confirm | size S | SWEEP-world-verdigris is marked done (olive-bronze recolour), and the ASK line above is still open. Nate has not confirmed the recolour. He should confirm it or pick the exact colour | `lib/automation/models/*/palette.ts`

## Resolution 2026-11-18 (thread "Sharpen game resolution on all screens")
- [x] RES-retina-canvas | size S | The island draws at device pixel ratio up to 2, so retina and phone pixel blocks are no longer stretched by the browser; block size and look unchanged. Done when 2x and 3x backing matches the screen and 1x is unchanged | `lib/automation/render/index.ts` (`deviceRatio`, `blockPixels`), `app/camino/brasswork.css` `.bw-canvas` | #712
- [x] RES-open-mood | size S | Nate chose Dusk (2026-11-18). New visitors open at Dusk (was a 0.4 day-dusk blend, mauve plateau); a saved mood still wins | `components/brasswork/brasswork-host.tsx` (mood default, island `timeOfDay`) | #715
- [ ] RES-phone-fps | size S | Check frame rate on a real phone after RES-retina-canvas (the pixel pass now fills about 4x the pixels at 2x on 3x phones). Not testable headless | `lib/automation/render/governor.ts`
- [x] RES-soft-seams | size S | Nate's close-up: hard lines of different colours where surfaces meet (deposit discs, plateau edge, path edges). The pixel pass now blends neighbouring block colours across each seam (`soft()` in `postfx.ts`) and keeps the dither on edges; block centres stay flat and the pixel look holds. Dither off alone removed only the speckle, not the seams. Before and after at 1440 and 390 in `/mnt/project-files/brasswork-washout-2026-11-19/`. Seams soften but do not vanish: the bright rim on deposit discs is still a hard band, a candidate for a later pass. Headless only, not checked on a real GPU | `render/postfx.ts` | #722
