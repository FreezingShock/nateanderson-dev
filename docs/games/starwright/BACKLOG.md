# Starwright: backlog

Audited 2026-11-15. Pick the top item under "Do now", ship it as one PR into `integration`, then tick it here and update [FEATURES.md](FEATURES.md) in the same PR. Items under "Needs Nate" wait for his taste call or his own playthrough; do not start them.

Before any change: `npm run test:nodefarm`. Visual changes also need PNG screenshots at 1440 and 390 in `/mnt/project-files/portfolio/starwright/<topic>/`.

## Do now (a thread can just do these, in order)

1. ~~**Screenshots of the planet break-apart.**~~ Done: `scripts/starwright/ui-art/planet-break.mjs`, PNGs in `portfolio/starwright/planet-break/`. Finding: the sheet `fx/planet-gone` is a faint expanding ring (18 frames, 64 px cells), not chunks, and it plays under the full-screen neutron blast, so the planets just vanish with the blast. Follow-up is item 1b.
1b. [x] **Redraw planet-gone as real cooling chunks.** Draw 5 to 7 dithered rock fragments that fly apart and glow from orange to dark, ~1.5 s, in `scripts/starwright/art/` (bump `VERSION`), and draw them above the blast in `art.ts`. Done when a shot shows chunks at the planets' positions 0.3 s into a neutron star at 1440 and 390.
2. [x] **List the rule changes for Nate.** Write one short block in the PR body and in `docs/starwright.md` ("Rules changed 2026-11-15"): l5 Corona (inflow x2, heat x1.2, 900 stardust, needs l4), a5 Iron rain (stardust x2, 1800, needs a3 and a4), deep stars (+4% each, 600 x1.4), the 20-star map. Done when the doc section and the project chat line both exist.
3. [x] **Document deep stars in `docs/starwright.md`.** The button exists in the star map but the doc never mentions it. Add what it costs, where it is, `sw deep`, and that a neutron star clears it. No code.
4. [x] **Stall credit tests in the browser path.** `advance` is tested, the game's timer wiring is not. Add a test that drives the tick function through a 1 to 3 s gap and a long gap and checks no time is lost. Files: `tests/starwright/session.test.mjs`, small export from `starwright.tsx` only if unavoidable.
5. [x] **Corrupt save visible to the player.** `loadSession` keeps damaged saves, but check that the card shows once and the old text survives a second reload; add a test for the second reload in `session.test.mjs`. Acceptance: no path replaces `sw-save-v1-corrupt` with a newer damaged save without keeping the older one.
6. [x] **Orbit thumbnails.** Planet previews in Orbit use the canvas `PlanetSprite`; confirm they use the drawn sheets for all 8 planets at all 4 stages (not the code fallback) and fix any that fall back. Done when a shot of Orbit at 1440 with every planet owned shows only drawn art.
7. [x] **Landscape phone pass.** Run the page at 844x390 and 667x375; no panel clipped, dock and ladder reachable, nothing under the notch. Fix in `starwright.css` only. Done when 3 screenshots at those sizes are in the folder.
8. [x] **Swipe hint on phones.** The scroll cue under the star exists; verify it disappears after the first scroll and returns after reload only once per session. Small CSS/state fix.
9. [x] **Hotkey test.** Add a headless Playwright check (run through `npm run build` + start) that presses 1, N, Q, Space, Esc and checks the state through the `sw:live` event. Put it under `tests/starwright/browser/` and wire it into docs/ci.md only if Nate asks for it as a PR check.
10. [x] **Offline pacing report.** Add a test that documents what a 24 h absence does with auto supernova on (it chains: each supernova restarts the star and autoburn only), and that with it off the star waits at the collapse line. No rule change; this pins the behaviour so the call under "Needs Nate" can be made on facts.
11. [x] **Phone star map framing.** At 390 wide the Constellations map opens cropped at the right (names cut off at the edge), "Fusion bloom" collides with "THE LOOM", and the help text under Deep stars sits flush on the screen edge with no margin or panel. Frame the map to fit (or start zoomed out), give the caption its own padded strip. Shot: `portfolio/starwright/walk-c-390.png`. Files: `panels.tsx` star map, `starwright.css`. Coordinate with the audio/animations thread, which is fixing overflow in menus. PARTLY DONE: the caption now has its padding and sits inside the screen. The map still pans sideways on a phone (min-width 700 px by design); names at the right edge need a swipe. Open: start the pan centred, owned by the audio/animations thread (star-chart.tsx).
12. [x] **Almanac element names on phone.** At 390 the element tiles clip long names ("Hydrogen" runs into its tile edge; "Magnesium" and "Silicon" touch). Shrink the name or let it wrap under 400 px. Shot: `walk-a-390.png`. DONE: 9px names, no wrap, under 520 px (`starwright-ev.css`).
13. [ ] **Welcome back and event cards: real-phone tap check.** Chips toggle the Almanac line on tap; confirm on a device (cloud tests are headless only). Also add a leaving animation once the audio/animations thread exposes its hook on `.sw-ev`.
14. [ ] **Menu card fits at 1440x900.** The Menu is 3 px taller than its box (scrollHeight 845 vs 842) so it can show a scrollbar; trim spacing. Overflow thread may fix it first; check before starting.

## Needs Nate (taste call or his own playtest)

- **His own playthrough of the first star.** The first supernova is about 13 minutes for the bot; people are slower. Needs his notes on the first minute, the first visitor, and whether the guide line is clear. Blocks any further pacing change.
- ~~Offline pacing~~ decided 2026-11-15: cap a few (3) supernovas per absence with auto supernova on. Done in the away-cap PR.
- ~~Rule changes l5 Corona, a5 Iron rain, deep stars~~ signed off by Nate 2026-11-15.
- **Next art pass.** Planet break-up chunks done (his pick 2026-11-15). Still offered, not picked: visitor and cloud cards, supernova and ending screens.
- **Audio.** Rebuilt 2026-11-15 (see FEATURES). Needs him to listen: WAVs in `/mnt/project-files/portfolio/starwright/motion-audio-overhaul/audio/`, then volume levels and which sounds to change. Real Safari autoplay unchecked.

## Cannot be tested in the cloud (his devices)
Safari/WebKit, real phones (touch, safe-area, performance), audio, the one-tab rule across two real tabs, and the live site (the password gate returns 401 to threads).

## Left alone on purpose
Do not add x10 or max buy buttons, tap clickers, third-party art or sound, a coloured strip on a panel's left edge, or pill chips and tabs. Scramble text never sticks.

## Performance (audit 2026-11-15, report in /mnt/project-files/portfolio/perf-audit-2026-11-15/starwright.md)
Play is fine: 60 fps, no long frames at 4x CPU, 5.5 MB heap flat over 98 s, engine step 7 microseconds. What is left is load on a slow phone and idle main-thread animation cost.
- [x] PERF-ui-preload | size S | Preload the above-the-fold UI art (stat and dock icons, the 10 el-*-anim strips, tier, frame, btn) and manifest.json from the route layout so they download during hydration, not after it (they start at ~3.3 s on a throttled phone and pop in ~0.7 s after the ladder). Done when the ladder and its art paint together in the 390 / 4x CPU / 1.6 Mbps trace | scripts: /mnt/project-files/portfolio/perf-audit-2026-11-15/ TRIED, DROPPED 2026-11-15: preloading all 36 (or a trimmed 11) images from layout.tsx did not move ladder time (median 2.92 s base, 3.34 s with 36, 3.13 s with 11, 390/4x CPU/1.6 Mbps, 3 runs) and added requests; the wait is hydration at 4x CPU, not the image download. Revisit only after PERF-ssr-skeleton.
- [x] PERF-main-thread-anims | size M | With every CSS animation off the page's main-thread time drops from ~40% to ~26% at 4x CPU (style recalc 8.7% to 0.4%). Culprits are the animations that cannot run on the compositor: tile strips and cloud art (background-position), the bar flow (background-position) and the ready glow (box-shadow). Tile strips as a transform on a ::before are pixel-identical (checked against the PNG strip) but alone only saved ~2 points; convert all four together and re-measure, or pause them when the tab is idle | app/camino/starwright.css DONE 2026-11-15: tile strips, cloud art and bar flow now slide a ::before with transform; the ready glow fades a ::after with opacity. Idle main thread 43.7% to 33.8% at 390/4x CPU (median of 5; style recalc 8.7% to 6.3%). With every animation off it is 25%, so ~9 points remain in the others (swDeal rows, hint bob, pulse); find which before converting more.
- [x] PERF-ui-version-dupes | size S | The CSS refers to the same UI PNGs with different `?v=` (frame, frame-warm, fill, head, btn-2, btn-3 at v=3, 7 and 8), so the browser downloads each twice. Keep one version per file | app/camino/starwright.css DONE: every UI PNG now uses ?v=8.
- [x] PERF-manifest-twice | size S | manifest.json (20 KB) is fetched by both sprites.ts and ui-sheets.ts. Share one promise | lib/starwright/sprites.ts, lib/starwright/ui-sheets.ts DONE: lib/starwright/manifest.ts shares one fetch.
- [x] PERF-ssr-skeleton | size M | The ladder and canvas only exist after hydration and the save load in useEffect; first contentful paint is the empty frame (~0.9 s) and the game shows at ~3.1 s on the throttled phone. Server-render a static skeleton (frame, title, "loading the star" line) so the first paint has the game's shape. Risk: hydration mismatch, so keep it markup-only | components/starwright/starwright.tsx DONE 2026-11-15: the boot screen is server-rendered as the scene, collapse panel and first three ladder rows (same markup on the client first render, so no mismatch). Load timings unchanged (ladder median ~2.8 s at 390/4x CPU); the change is what the first paint shows. Shots: boot-skeleton-*.png.

## Motion, sound, overflow (2026-11-15, thread "Overhaul Starwright audio and animations")
- [x] MOTION-language | one set of curves and an order of arrival for every menu, panel swaps, page flips, star map iris
- [x] AUDIO-rebuild | new sound.ts, volume setting, cues on buy, perk, planet, ignition, menus
- [x] OVERFLOW-none | measured paging for Orbit, Almanac, Menu; phone star map per constellation
- [ ] MOTION-visitor-cloud-away | open/close for visitor, birth cloud and welcome cards once the backlog thread's shared panel style lands
- [ ] MOTION-real-device | judge the motion and sound on a real phone and with speakers

## Pre-deploy audit 2026-11-16 (report: /mnt/project-files/portfolio/starwright/predeploy-2026-11-16/REPORT.md)
- [x] AUDIT-almanac-phone-names | size S | Almanac element names overlapped their neighbours at 360 to 390 wide (the 9px names added under "Do now" item 12 collided with the symbol, so that item is superseded). Phones now show the symbol only, and the name opens in the tap sheet | `app/camino/starwright-ev.css`
- [x] AUDIT-constellations-phone-header | size S | At 560 px and under the stardust counter ran under the close button. The bar now pads for the button | `app/camino/starwright.css`
- [x] AUDIT-keys-columns | size S | Keys list in the Menu: each row sized its own key column, so descriptions did not line up. One grid now | `app/camino/starwright.css`
- [x] AUDIT-kiln-labels-phone | size S | At 390 the dim, locked Kiln and Loom labels sat under faint node labels and the "THE KILN" title, so the locked constellations read as a smear. DONE: on a phone only the constellation on screen is drawn (the others are hidden, not ghosted), and constellation titles draw over the node labels with a wider dark halo | `components/starwright/star-chart.tsx`, `app/camino/starwright.css`
- [x] AUDIT-protostar-label | size S | The "Protostar" stage label sat under a scene sparkle at 1440 and 390 at the top left. DONE: the readout (SOL, mass, heat, age, stage) sits on a dark backing | `app/camino/starwright.css`
- [ ] ASK AUDIT-detail-sheet-wrap | size S | The Almanac tap sheet breaks "Neon · weight 20" across lines at 390. Taste call on the sheet's header layout
- [ ] AUDIT-real-phone-pass | size M | Not testable in the cloud: Safari, touch on a real phone, sound. Needs Nate's playthrough (see MOTION-real-device)
- [x] AUDIT-cards-visual | size S | Visual pass on the visitor, birth cloud, welcome-back, neutron star (ready and formed) and black hole (ending) cards at 1440 and 390. Found: the phone "Scroll for the ladder" cue sat on the visitor card's second option and on the collapse panel. Fixed: it moves to the star's lower edge in portrait and waits while an event, welcome or cloud card is up | `app/camino/starwright-qol.css`

## Phone map and Almanac (2026-11-16, thread "Fix Starwright map and Almanac on phones")
- [x] PHONE-almanac-card-in-panel | size S | The menu card was sized to the screen (100dvh), so on a phone it was taller than the game panel and its title and close button sat under the site bar. Cards now take the scrim's height (`.sw-over > .sw-card`) | `app/camino/starwright.css`
- [x] PHONE-almanac-pages | size S | Milestones are one tight row on phones (30 px medal), so the Almanac pages in 3 to 5 steps instead of 6 to 8; the tap sheet keeps its art full width; the flip bar fits a 360 px card | `app/camino/starwright.css`
- [x] PHONE-map-room | size S | The star map was squeezed to about 50 px at 360 by the Deep stars card. The card is one compact row on phones and the map's explanation is hidden there; the constellation now fills the area above the card | `app/camino/starwright.css`
- [x] PHONE-map-centred | size S | Measured headless: the constellation's visible span is within 10 px of the map's centre at 360 and 390, both constellations. No change beyond the room above | `scripts/starwright/ui-art/map-almanac-shots.mjs`
- [x] PHONE-tap-tip | size S | A hover tip for the element under the finger opened on top of the tap sheet on touch. Tiles show no tip while the sheet is open | `components/starwright/panels.tsx`
- [x] PHONE-name-field | size S | The star name field was wider than its box at 360 (default input width). It fills its box | `app/camino/starwright.css`

