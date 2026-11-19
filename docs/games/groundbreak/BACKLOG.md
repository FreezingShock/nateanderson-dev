# Groundbreak: backlog

Format and rules: `docs/WORKFLOW.md`. Consolidated 2026-11-16 into the standard sections: Now (open, not waiting on Nate), Needs Nate, Ideas, Done. Finished items are condensed to one line each; the full acceptance text is in git history at `5138bb6f` and earlier. Features and code map: [FEATURES.md](./FEATURES.md). Read FEATURES.md "Owners" before touching a file.

How to verify a UI item: production build, 1440 and 390 wide, PNGs saved to `/mnt/project-files/portfolio/groundbreak/<topic>/`, no console warnings. Engine items: add a test in `tests/groundbreak/` and run `npm run test:nodefarm`. HUD checks: `docs/ci.md` (Groundbreak HUD check).

## Now (open, ordered: top is next)
- [x] GB-window-390-keys-wheel | size S | Closed 2026-11-18: the window suite passes at 390 on integration (game keys and wheel both scroll as expected); the cited `scripts/games/window-check.mjs` was removed by #691, so the check now lives in `scripts/ci/checks/run.mjs window`. Old text follows | `scripts/games/window-check.mjs` fails two Groundbreak checks at 390 wide: "game keys do not scroll the page" (scrollY 0) and "wheel over the title bar scrolls the page" (0 to 0). Confirmed on a pristine `integration` build at 336ffe5, before the new-game template PR (#693), so it predates that change. Find out whether the panel is clipped at 390 or the page has no scroll range, then fix the game or the check expectation | `components/groundbreak/groundbreak.tsx`, `app/camino/groundbreak.css`, `scripts/games/window-check.mjs`
- [x] GB-change-order-check | size S | Done 2026-11-18: the change-order card ran under the dock on desktop and phone; the job card now ends above the dock and cue or zoom beside it, and a HUD seed (`late, change order`) checks it at every size | `groundbreak.tsx`, `groundbreak.css`, `scripts/ci/seeds/groundbreak-change.json` |
- [x] GB-tap-targets | size S | Done 2026-11-18: zoom and rail buttons on phones are 44 px, the touch floor. On a landscape phone the rail row sits at the right so it clears the job card; the HUD check passes at all sizes including the late seed and change order | `app/camino/groundbreak.css`

- [x] SWEEP-hud-late-zoom-job | size S | On the late seed (`seeds/late180.json`) at 1440 the zoom buttons overlapped the job card. Fixed by PR 664; the late seed is now checked by `scripts/ci/checks/run.mjs hud` and passes at all seven sizes | `app/camino/groundbreak.css` (`.gb-zoom`, `.gb-job`) | #664

## Needs Nate (taste call, playtest or his own device)
- [ ] ASK GB-pacing-playthrough | size S | Pacing: about 3 h to the bridge, a material every 12 to 15 min. The bot passes; nobody has felt it yet. After he plays, the numbers in `data.ts` (TUNE) get retuned | playtest
- [ ] ASK GB-incorporate-feel | size S | How strong should the second firm feel? Recommend firm 2 at about 1 h 45 and firm 3 at about 1 h 30 (SPEC). Needed before any more Incorporate numbers ship | taste
- [ ] ASK GB-windows-dock | size S | Windows over the site (Jobs and Firm): side-docked panel on desktop, or a smaller window. Recommend side-docked on desktop, bottom sheet on phone | taste
- [ ] ASK GB-repeat-orders | size S | Repeat orders pay 50% cash and 10% rep with no new building. Keep the rule or drop it; he has seen the feature only in passing, so confirm after his playthrough | playtest
- [ ] ASK PERF-gb-real-device | size S | All numbers in `/mnt/project-files/portfolio/perf-audit-2026-11-15/groundbreak.md` are headless Chromium. Needs a real phone: playable time, frame feel with the tower at 40 storeys, and a multi-hour soak. Scene-art preloading gave no gain in time to playable, so do not redo it without new evidence | device
- [x] ASK GB-perk-names-touch | size S | Chosen by Nate 2026-11-18: tap to read, tap again to buy. Built: first tap shows the name and effect in the Firm footer, second tap buys | taste
- [x] ASK GB-firm-desktop-layout | size S | Chosen by Nate 2026-11-18: two columns. Built: stats and Incorporate left, perk grid right; the long reason copy is hidden on desktop (the footer line says the same) | taste
- [x] ASK GB-crews-chip-phone | size S | Done 2026-11-18: Nate chose "Show it as icon and number". The Crews chip shows on phones. To fit the three chips at 390 px the East Bay label is hidden on phones; the Firm window still names the city | `app/camino/groundbreak.css`
- [ ] ASK GB-real-phone-safari | size S | Real phone and Safari playthrough. Neither can be tested by a thread | device
- [ ] ASK GB-live-check | size S | Live-site check after the next deploy. The password gate returns 401 to threads | device

## Ideas
- [ ] ASK GB-new-content | size M | Extra regions, jobs and art subjects. Ask before inventing any of it | taste

## Standing notes
- Do not invent new content (regions, jobs, art subjects) without asking Nate.
- The site's fog bank is baked into the hills layer, so Simple visuals cannot toggle it. Do not add a toggle without re-checking the art.
- Headless numbers (60 fps idle and zooming at 1440 and 390, no GPU) are not a device measurement.

## Done (newest appended at the end)
- [x] DONE-1 | NEXT cue no longer overlaps the zoom buttons at 390 and 360 wide (`app/camino/groundbreak.css`, dock-height fix)
- [x] DONE-2 | Jobs and Firm windows no longer cover the site: narrower window or side dock, no scrim; phone uses a bottom sheet; blank-space click still closes
- [x] DONE-3 | Stronger Incorporate: firm 2 about 102 min, firm 3 about 95 min in the bot run; the first firm stays about 3 h. `docs/rule-changes/2026-11-15-groundbreak-stronger-incorporate.md`
- [x] DONE-4 | Repeat orders are named in the job card, the Jobs window (what it pays) and the handover toast
- [x] DONE-5 | Fog bank checked 2026-11-15: nothing to fix; the fog is baked into the hills layer
- [x] DONE-6 | Screenshot diff on PR #534 explained (engine change: material stocks 60 s of output; animation timing, not a rendering bug)
- [x] DONE-7 | Hover names: every dock tile has a `data-tip` name and every HUD button has an `aria-label`; verified on touch, no code change
- [x] DONE-8 | First prototype deleted (`engine.ts`, `commands.ts`, `scene.tsx` in `components/groundbreak`); `scene-types.ts` stays
- [x] DONE-9 | Tests for the untested rules in `tests/groundbreak/engine.test.mjs` (crew milestone doubling, reputation boost, city bonuses, `catchUp` with Night watch). The other-tab save guard lives in the component and is not a pure function, so it is not covered
- [x] DONE-10 | `SPEC.md` updated and `gb help` lists every console command
- [x] DONE-11 | Phone landscape fits (844x390, 932x430, 667x375); corrupt save keeps a copy under `gb-save-v1-corrupt` and warns the player; warnings are sticky for 20 s
- [x] DONE-12 | Phone portrait dock: later groups hide until reached, so the dig gets most of the screen
- [x] DONE-13 | Window panels are opaque (`.985`)
- [x] DONE-14 | Firm window: Incorporate line pinned at the bottom; perks scroll
- [x] DONE-15 | HUD overlap check `scripts/ci/checks/run.mjs hud`, documented in `docs/ci.md`
- [x] DONE-16 | Waiting cue names the next job's wait and the repeat order
- [x] GB-pixel-snap | Nate chose snap at rest (2026-11-15): art scale snaps to whole device pixels once the camera settles; never mid-zoom | `site-scene.tsx` `s`, `layer()`
- [x] PERF-gb-icons-sheet | `Ico` draws every icon from `icons.webp` (one request, was 35+); 1440 and 390 PNGs match the before set
- [x] PERF-gb-font-preloads | Barlow 600 preload removed and its file deleted (no display style uses 600); Barlow 700 and Plex 400, 500, 600 stay preloaded. Done in the 2026-11-16 audit
- [x] AUDIT-2026-11-16-console | A `gb` command ran inside a state updater, so React warned and the command could run twice; it now runs once, in the submit handler
- [x] AUDIT-2026-11-16-hint-ring | The amber "next" ring shared `::after` with the tooltip, drawing a dark box over icons and text; the ring now resets the tooltip box and hover shift
- [x] AUDIT-2026-11-16-touch-space | The cue's "Space" hint is hidden on touch screens
- [x] AUDIT-2026-11-16-welcome-back | Welcome-back card sits above the windows until dismissed
- [x] AUDIT-2026-11-16-phone-job-card | Phone 390: the job status (permit, inspection, %) drops under the name so "SIDEWALK RUN" stays on one line
- [x] AUDIT-2026-11-16-firm-fade | A fade sits above the pinned Incorporate line, so the cut-off perk row reads as "scroll for more"
- [x] SKYLINE-phone | Skyline window lists every job, named, with its count or as a silhouette; Firm window on phones puts perk rows first. Before and after in `/mnt/project-files/groundbreak-skyline-2026-11-16/` (headless only)
- [x] HUD-stacking | Page publishes the dock's real height as `--gb-dock-top` on `.gb-root`; cue, view buttons, feed and material card sit on it. Check script: `/mnt/project-files/portfolio/groundbreak/hud-overlap/check.mjs`
- [x] FOG-check | Fog sits behind the hills, never over a job; the bridge stage is clear. Shots in `/mnt/project-files/portfolio/groundbreak/fog/`
- [x] ITEM-7-touch-names | Touch check at 390: 0 unnamed buttons, tapping a dock tile opens its card and buys nothing
- [x] LANDSCAPE-check | Overlap check now includes 667x375; shots in `/mnt/project-files/portfolio/groundbreak/landscape/`
- [x] CORRUPT-save-check | Headless check `/mnt/project-files/portfolio/groundbreak/corrupt/check.mjs` at 1440 and 390
- [x] SWEEP-dock-locked-names | Locked dock tiles wrap the material name to two lines instead of cutting it ("PRECAST PAN...", "STEEL BE..." at 1440 and 390); 88 px tall on desktop, 90 px on phones; landscape phones keep 50 px | `app/camino/groundbreak.css` (`gb-tile-name`, `data-state="locked"`)
- [x] RECENT-batch | Earlier PRs, do not redo: reward moments (material ring, hot feed glow), first minute plays itself (#491), zoom to 5x (#487), staged jobs and Bay backdrop (#478, #482), engine pacing and repeat orders (#506), site life (#502), icons and menu art (#498), QOL cue, welcome-back, backups, console (#515), change-order cost card (e303c356), material arrives stocked (#534), skyline window art, shore traffic, fog bank (#539 to #543)
- [ ] SITE-review-gb-tiny | S | found by the 2026-11-18 phone pass: key hints (J, K, F, Ctrl+J, M, Space) and some dock names (Rebar, Steel beams, Glass panels, Copper wire) are 10px on desktop and phone; on phones the Pause, Full screen and Games back link are 36 to 40px tall (44px touch target) | from thread "Review site pages and new features" | Groundbreak owner decides
- [x] GUI-overhaul-2026-11-19 | One toolbar, Next move key with cost and progress, affordable-tile stripe, labelled job card, anchored material card, Skyline two-column fix, amber palette, buy and handover juice | #PR
- [ ] GUI-overhaul-playtest | S | Nate: play 10 minutes from a fresh save, hold Space and buy from the dock; say whether it is clear what to do and whether the juice feels right or too much | Nate's playtest
- [ ] GUI-overhaul-real-device | S | check on a real phone, Safari and a real GPU: tile pop, banner timing, toolbar icons at 390 and 360 wide, landscape toolbar | untested beyond headless Chromium
- [ ] GUI-overhaul-tiny-text | S | 10px text remains only in landscape-phone dock names and level tags; key hints and dock names are 11px or larger elsewhere (partly answers SITE-review-gb-tiny) | Groundbreak owner

