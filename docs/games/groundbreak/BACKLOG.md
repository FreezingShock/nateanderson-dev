# Groundbreak: backlog

Ordered. A fresh thread can take the top item under "A thread can do these" and ship it with no questions. Features and code map: [FEATURES.md](./FEATURES.md). Read FEATURES.md "Owners" before touching a file.

How to verify any UI item: production build, 1440 and 390 wide, PNGs saved to `/mnt/project-files/portfolio/groundbreak/<topic>/`, no console warnings. Engine items: add a test in `tests/groundbreak/` and run `npm run test:nodefarm`.

Last audited 2026-11-15, `integration` at 5138bb6f.

## A thread can do these

### 1. NEXT cue overlaps the zoom buttons at 390 wide (DONE, shipped with the dock-height fix)
- Where: `app/camino/groundbreak.css`. At 860 px and under `.gb-cue` is `bottom: 232px` and full width; `.gb-zoom` is `bottom: 190px`, `right: 8px`, in a row.
- Done when: at 390 and 360 wide the cue and zoom buttons do not overlap, the cue still points at its tile, and the dock and feed stay clear. Check the landscape phone rules too (`max-height: 500px`).

### 2. Jobs and Firm windows cover the site
- Where: `Window` and the `gb-win` rules; Jobs is `unroll`, Firm is `stamp` and `size="lg"`.
- Done when: at 1440 the site stays visible beside Jobs and Firm (narrower window or docked to a side, no scrim), and on a phone it is a bottom sheet that leaves the job site showing above. Clicking blank space still closes it, and the open and close animations keep their own styles.

### 3. Stronger Incorporate
- Where: `data.ts` TUNE (`charterDiv`, `charterMinRep`), PERKS costs, CITIES `mat`/`fx`; test "the second firm beats the first" in `tests/groundbreak/engine.test.mjs`.
- Now: the second firm is only about 25% faster than the first. SPEC aims for later runs reaching the bridge in about 1 h 30.
- Done when: a test run by the bot shows firm 2 reaching the bridge at least 35% faster than firm 1 (target about 1 h 30 by firm 3), the first firm is still about 3 h, and a first-time player can see in the Firm window what Incorporate gives before they press it. Run the sim and put the before and after numbers in the PR.

### 4. Label repeat orders everywhere
- Where: `groundbreak.tsx`. The only label today is the small "Repeat order" tag in the job card header. The Jobs window and the toasts do not say a job is a repeat and that it pays a share (50% cash, 10% rep, no new building).
- Done when: a repeat is named in the job card, the Jobs window (what it pays), and the handover toast.

### 5. Fog bank seen in the running game
- Where: `components/groundbreak-art/site-scene.tsx` (2696bbd9).
- Done when: screenshots at 1440 and 390 on a production build show the fog over the bridge saddle during the stage-5 bridge and at the other stages, it does not cover the job, and Simple visuals turns it off. Fix whatever looks wrong.

### 6. Screenshot diff on PR #534 (5.2% and 2.9%)
- #534 changed the engine only (opening a material stocks 60 s of output), so the diff is most likely animation timing or the new starting stock, not a rendering bug.
- Done when: download the `screenshot-diff` artifact for that run, say what changed on each route, and confirm no Groundbreak art shifted. If it is a false positive, write one line in `docs/ci.md` about it.

### 7. Hover names on touch and unlabeled controls
- The dock tiles already have `data-tip` names. Touch has no hover.
- Done when: a tap on a tile on a phone shows the name and rate without buying anything, and every HUD button (rail, zoom, cue, job card) has a name in a tooltip on desktop and an `aria-label`.

### 8. Delete the first prototype (done, code audit PR)
- `components/groundbreak/engine.ts`, `commands.ts`, `scene.tsx` are not imported anywhere (see FEATURES.md "Dead code"). `scene-types.ts` stays.
- Done when: the three files are gone, typecheck and the build pass, and `rg "groundbreak/engine"` finds nothing.

### 9. Tests for the untested rules
- Add to `tests/groundbreak/engine.test.mjs`: crew milestone doubling, reputation boost, city material bonuses, the other-tab save guard if it can be pulled into a pure function, and `catchUp` with the Night watch perk.
- Done when: each has a failing-then-passing assertion on a real state change, not only "did not throw".

### 10. Stale spec and docs
- `/mnt/project-files/portfolio/groundbreak/SPEC.md` still describes a bid board and 105 Gravel unlock prices. Update it (or replace it with a short pointer to FEATURES.md) so a new thread is not misled.
- The console `help` and `gb` subcommand list in `commands.ts` should name every command; check `gb open`, `gb jobs`.

### 11. Phone landscape, fractional-pixel shimmer, corrupt-save handling (from earlier notes)
- Phone landscape: the dock, rail, cue and a window at 844 x 390 all fit and nothing covers the dig.
- Shimmer: sprites and strips at fractional zoom show no shimmer; snap the camera to the pixel grid or round positions in `site-scene.tsx`.
- Corrupt save: when `parse` returns null for a present but broken save, the page keeps a copy under a backup key and tells the player, instead of silently starting fresh. Test it.
- Split into three PRs if one grows.

## Needs Nate

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
