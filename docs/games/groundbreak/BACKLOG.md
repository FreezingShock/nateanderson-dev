# Groundbreak: backlog

Ordered. A fresh thread can take the top item under "A thread can do these" and ship it with no questions. Features and code map: [FEATURES.md](./FEATURES.md). Read FEATURES.md "Owners" before touching a file.

How to verify any UI item: production build, 1440 and 390 wide, PNGs saved to `/mnt/project-files/portfolio/groundbreak/<topic>/`, no console warnings. Engine items: add a test in `tests/groundbreak/` and run `npm run test:nodefarm`.

Last audited 2026-11-15, `integration` at 5138bb6f.

## A thread can do these

### 1. NEXT cue overlaps the zoom buttons at 390 wide (DONE, shipped with the dock-height fix)
- Where: `app/camino/groundbreak.css`. At 860 px and under `.gb-cue` is `bottom: 232px` and full width; `.gb-zoom` is `bottom: 190px`, `right: 8px`, in a row.
- Done when: at 390 and 360 wide the cue and zoom buttons do not overlap, the cue still points at its tile, and the dock and feed stay clear. Check the landscape phone rules too (`max-height: 500px`).

### 2. Jobs and Firm windows cover the site (DONE)
- Where: `Window` and the `gb-win` rules; Jobs is `unroll`, Firm is `stamp` and `size="lg"`.
- Done when: at 1440 the site stays visible beside Jobs and Firm (narrower window or docked to a side, no scrim), and on a phone it is a bottom sheet that leaves the job site showing above. Clicking blank space still closes it, and the open and close animations keep their own styles.

### 3. Stronger Incorporate (DONE: firm 2 about 102 min, firm 3 about 95 min in the bot run; see docs/rule-changes/2026-11-15-groundbreak-stronger-incorporate.md)
- Where: `data.ts` TUNE (`charterDiv`, `charterMinRep`), PERKS costs, CITIES `mat`/`fx`; test "the second firm beats the first" in `tests/groundbreak/engine.test.mjs`.
- Now: the second firm is only about 25% faster than the first. SPEC aims for later runs reaching the bridge in about 1 h 30.
- Done when: a test run by the bot shows firm 2 reaching the bridge at least 35% faster than firm 1 (target about 1 h 30 by firm 3), the first firm is still about 3 h, and a first-time player can see in the Firm window what Incorporate gives before they press it. Run the sim and put the before and after numbers in the PR.

### 4. Label repeat orders everywhere (DONE: job card, Jobs window row, finish toast)
- Where: `groundbreak.tsx`. The only label today is the small "Repeat order" tag in the job card header. The Jobs window and the toasts do not say a job is a repeat and that it pays a share (50% cash, 10% rep, no new building).
- Done when: a repeat is named in the job card, the Jobs window (what it pays), and the handover toast.

### 5. Fog bank seen in the running game (DONE 2026-11-15: checked, nothing to fix; the fog is baked into the hills layer, so Simple visuals cannot toggle it)
- Where: `components/groundbreak-art/site-scene.tsx` (2696bbd9).
- Done when: screenshots at 1440 and 390 on a production build show the fog over the bridge saddle during the stage-5 bridge and at the other stages, it does not cover the job, and Simple visuals turns it off. Fix whatever looks wrong.

### 6. Screenshot diff on PR #534 (5.2% and 2.9%) (DONE: explained from the diff and later runs; artifact itself not downloadable from a thread)
- #534 changed the engine only (opening a material stocks 60 s of output), so the diff is most likely animation timing or the new starting stock, not a rendering bug.
- Done when: download the `screenshot-diff` artifact for that run, say what changed on each route, and confirm no Groundbreak art shifted. If it is a false positive, write one line in `docs/ci.md` about it.

### 7. Hover names on touch and unlabeled controls (DONE 2026-11-15: already true, verified; no code change)
- The dock tiles already have `data-tip` names. Touch has no hover.
- Done when: a tap on a tile on a phone shows the name and rate without buying anything, and every HUD button (rail, zoom, cue, job card) has a name in a tooltip on desktop and an `aria-label`.

### 8. Delete the first prototype (done, code audit PR)
- `components/groundbreak/engine.ts`, `commands.ts`, `scene.tsx` are not imported anywhere (see FEATURES.md "Dead code"). `scene-types.ts` stays.
- Done when: the three files are gone, typecheck and the build pass, and `rg "groundbreak/engine"` finds nothing.

### 9. Tests for the untested rules (DONE 2026-11-15 except the other-tab save guard, which lives in the component and is not a pure function)
- Add to `tests/groundbreak/engine.test.mjs`: crew milestone doubling, reputation boost, city material bonuses, the other-tab save guard if it can be pulled into a pure function, and `catchUp` with the Night watch perk.
- Done when: each has a failing-then-passing assertion on a real state change, not only "did not throw".

### 10. Stale spec and docs (DONE 2026-11-15: SPEC.md updated, `gb help` added and tested)
- `/mnt/project-files/portfolio/groundbreak/SPEC.md` still describes a bid board and 105 Gravel unlock prices. Update it (or replace it with a short pointer to FEATURES.md) so a new thread is not misled.
- The console `help` and `gb` subcommand list in `commands.ts` should name every command; check `gb open`, `gb jobs`.

### 11. Phone landscape (DONE 2026-11-15), fractional-pixel shimmer (ASK, see Needs Nate), corrupt-save handling (DONE 2026-11-15)
- Phone landscape: the dock, rail, cue and a window at 844 x 390 all fit and nothing covers the dig.
- Shimmer: sprites and strips at fractional zoom show no shimmer; snap the camera to the pixel grid or round positions in `site-scene.tsx`.
- Corrupt save: when `parse` returns null for a present but broken save, the page keeps a copy under a backup key and tells the player, instead of silently starting fresh. Test it.
- Split into three PRs if one grows.

### PERF-gb-icons-sheet | size S
- First paint requests about 30 single-icon PNGs (1 to 2 KB each, `components/groundbreak/icons.ts`) although `public/groundbreak/icons/icons.webp` holds them as a sheet. Done when: first paint needs one icon request, 1440 and 390 PNGs match before and after, and the transfer count drops by about 30.

### PERF-gb-font-preloads | size S
- The site root preloads Plex Mono 400 and Arimo, and Groundbreak preloads Barlow 600, none used on first paint (about 56 KB, roughly 0.3 s on a throttled phone). Root fonts are outside this area; check `docs/OWNERS.md`. Done when: unused preloads are gone and no text changes face.

### PERF-gb-real-device | size S
- All numbers in `/mnt/project-files/portfolio/perf-audit-2026-11-15/groundbreak.md` are headless Chromium. Needs Nate or a real phone: playable time, frame feel with the tower at 40 storeys, and a multi-hour soak. Preloading the scene art was tried and gave no gain in time to playable (bandwidth bound), so do not redo it without new evidence.

## Needs Nate

- [ ] ASK GB-pixel-snap | size M | Fractional-pixel shimmer: camera offsets and sprite positions are already whole pixels, but the art scale (fit x zoom) is fractional, so each art pixel is 2 or 3 screen pixels wide and a walking worker's shape can flicker. Fix is to snap the scale to whole device-pixel steps once the camera settles (a small pop of up to about 20% at rest) or leave it. Recommend: snap at rest, never mid-zoom. | `site-scene.tsx` `s`, `layer()`

| Item | What is needed |
|---|---|
| Pacing (about 3 h to the bridge, a material every 12 to 15 min) | His own playthrough. The bot passes; nobody has felt it. After he plays, items 3 and the numbers in `data.ts` get retuned. |
| Incorporate: how strong should the second firm feel | Taste call. Recommend firm 2 at about 1 h 45 and firm 3 at about 1 h 30 (SPEC). Needed before item 3 ships numbers. |
| Windows over the site (item 2): side-docked panel or a smaller window | Taste call. Recommend side-docked on desktop, bottom sheet on phone. |
| Repeat orders: keep the rule (50% cash, 10% rep) or drop it | He has seen the feature only in passing; confirm after his playthrough. |
| Live-site check after the next deploy | The password gate returns 401 to threads. |
| Real phone and Safari | Neither can be tested by a thread. |
| New content (extra regions, jobs, art subjects) | Ask before inventing. |

## Done recently (do not redo)

First minute plays itself (#491), zoom to 5x (#487), staged jobs and Bay backdrop (#478, #482), engine pacing and repeat orders (#506), site life (#502), icons and menu art (#498), QOL cue, welcome-back, backups, console (#515), change-order cost card (e303c356), material arrives stocked (#534), skyline window art, shore traffic, fog bank (#539 to #543).

HUD stacking (item 1): the page publishes the dock's real height as `--gb-dock-top` on `.gb-root`; cue, view buttons, feed and material card sit on it. Check script with overlap measurements at six sizes: `/mnt/project-files/portfolio/groundbreak/hud-overlap/check.mjs`.

Fog check (item 5): screenshots of sidewalk, clinic, tower, stadium and the bridge at 30% and 95% at 1440 and 390 in `/mnt/project-files/portfolio/groundbreak/fog/` (`shoot.mjs`, needs `VOXEL_BENCH=1`). The haze sits behind the hills, never over a job, and the bridge stage is clear.

Item 7 check (390 wide, touch emulation, production build): every button and link in the game has an accessible name and a tooltip (0 unnamed, 0 without data-tip). Tapping a dock tile opens its card with the name, rate and stock and buys nothing. Script was a throwaway; the claim is also covered by reading the markup in `groundbreak.tsx`.

Phone landscape (item 11a): at 844x390, 932x430 and 667x375 windows and the material card end above the dock and below the header, the cue stays clear of the rail and job card, the feed hides while a window is open. Screenshots `/mnt/project-files/portfolio/groundbreak/landscape/`; overlap check `hud-overlap/check.mjs` now includes 667x375.

Corrupt save (item 11c): the game already kept a copy under `gb-save-v1-corrupt` and started a fresh firm, but the warning toast was pushed out by the first-minute toasts within a second, so nobody could read it. Warnings are now sticky (20 s, later toasts do not evict them), also for the storage-blocked warning. Headless check `/mnt/project-files/portfolio/groundbreak/corrupt/check.mjs` (copy kept, player told, fresh start, no errors at 1440 and 390).

## Found during the 2026-11-15 pass (do these next, top first; polish pass recommended to Nate)

### 12. Phone portrait: the dock takes about 40% of the screen
- At 390 and 360 wide the dock wraps to 3 rows (about 330 px) and the site gets the top half. Done when: groups collapse to one open row (the group of the selected or newest material) with the others one tap away, and the dig is at least 55% of the screen; number keys and the NEXT cue still work.

### 13. Window panels look see-through
- Jobs, Firm and the material card show the scene faintly behind their text (`--gb-panel` is translucent). Done when: body text sits on an opaque or near opaque panel at 1440 and 390 and still reads as part of the scene (check contrast of the dim text).

### 14. Firm window needs scrolling to reach everything on small heights
- At 900 tall the perk grid plus the Incorporate line fills the window; on shorter screens the button scrolls out of sight. Done when: the Incorporate button and its line stay pinned at the bottom of the Firm window while the perks scroll.

### 15. Tests for the pure part of the HUD
- `--gb-dock-top` and the window sizes have only a headless script (`hud-overlap/check.mjs`). Done when: the script runs in `scripts/ci` against the built site as an advisory check, or its sizes are listed in `docs/ci.md` for threads to run before merging HUD changes.

### 16. Repeat order payout and the cue
- The NEXT cue says nothing about a running repeat order. Done when: while the crew is on a repeat order the cue (or the job card) says why the next campaign job has not started and what it waits on.
