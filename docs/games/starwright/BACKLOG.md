# Starwright: backlog

Audited 2026-11-15. Pick the top item under "Do now", ship it as one PR into `integration`, then tick it here and update [FEATURES.md](FEATURES.md) in the same PR. Items under "Needs Nate" wait for his taste call or his own playthrough; do not start them.

Before any change: `npm run test:nodefarm`. Visual changes also need PNG screenshots at 1440 and 390 in `/mnt/project-files/portfolio/starwright/<topic>/`.

## Do now (a thread can just do these, in order)

1. ~~**Screenshots of the planet break-apart.**~~ Done: `scripts/starwright/ui-art/planet-break.mjs`, PNGs in `portfolio/starwright/planet-break/`. Finding: the sheet `fx/planet-gone` is a faint expanding ring (18 frames, 64 px cells), not chunks, and it plays under the full-screen neutron blast, so the planets just vanish with the blast. Follow-up is item 1b.
1b. **Redraw planet-gone as real cooling chunks.** Draw 5 to 7 dithered rock fragments that fly apart and glow from orange to dark, ~1.5 s, in `scripts/starwright/art/` (bump `VERSION`), and draw them above the blast in `art.ts`. Done when a shot shows chunks at the planets' positions 0.3 s into a neutron star at 1440 and 390.
2. **List the rule changes for Nate.** Write one short block in the PR body and in `docs/starwright.md` ("Rules changed 2026-11-15"): l5 Corona (inflow x2, heat x1.2, 900 stardust, needs l4), a5 Iron rain (stardust x2, 1800, needs a3 and a4), deep stars (+4% each, 600 x1.4), the 20-star map. Done when the doc section and the project chat line both exist.
3. **Document deep stars in `docs/starwright.md`.** The button exists in the star map but the doc never mentions it. Add what it costs, where it is, `sw deep`, and that a neutron star clears it. No code.
4. **Stall credit tests in the browser path.** `advance` is tested, the game's timer wiring is not. Add a test that drives the tick function through a 1 to 3 s gap and a long gap and checks no time is lost. Files: `tests/starwright/session.test.mjs`, small export from `starwright.tsx` only if unavoidable.
5. **Corrupt save visible to the player.** `loadSession` keeps damaged saves, but check that the card shows once and the old text survives a second reload; add a test for the second reload in `session.test.mjs`. Acceptance: no path replaces `sw-save-v1-corrupt` with a newer damaged save without keeping the older one.
6. **Orbit thumbnails.** Planet previews in Orbit use the canvas `PlanetSprite`; confirm they use the drawn sheets for all 8 planets at all 4 stages (not the code fallback) and fix any that fall back. Done when a shot of Orbit at 1440 with every planet owned shows only drawn art.
7. **Landscape phone pass.** Run the page at 844x390 and 667x375; no panel clipped, dock and ladder reachable, nothing under the notch. Fix in `starwright.css` only. Done when 3 screenshots at those sizes are in the folder.
8. **Swipe hint on phones.** The scroll cue under the star exists; verify it disappears after the first scroll and returns after reload only once per session. Small CSS/state fix.
9. **Hotkey test.** Add a headless Playwright check (run through `npm run build` + start) that presses 1, N, Q, Space, Esc and checks the state through the `sw:live` event. Put it under `tests/starwright/browser/` and wire it into docs/ci.md only if Nate asks for it as a PR check.
10. **Offline pacing report.** Add a test that documents what a 24 h absence does with auto supernova on (it chains: each supernova restarts the star and autoburn only), and that with it off the star waits at the collapse line. No rule change; this pins the behaviour so the call under "Needs Nate" can be made on facts.

## Needs Nate (taste call or his own playtest)

- **His own playthrough of the first star.** The first supernova is about 13 minutes for the bot; people are slower. Needs his notes on the first minute, the first visitor, and whether the guide line is clear. Blocks any further pacing change.
- **Offline pacing.** Should a long absence give one supernova and stop (the star waits at the line), or a chain (today with auto supernova on)? Recommend: chain only up to the auto-nova limit, cap at a few per absence so he does not return to a reset game. Needs his answer, then it is a small `advanceAuto` change plus a test.
- **Rule changes l5 Corona and a5 Iron rain.** Already live in the code; he has not signed off on the numbers.
- **Next art pass.** Offered, not picked: visitor and cloud cards, supernova and ending screens (Orbit and Almanac cards are done).
- **Audio.** Needs him to listen: sound start, mute, volume levels.

## Cannot be tested in the cloud (his devices)
Safari/WebKit, real phones (touch, safe-area, performance), audio, the one-tab rule across two real tabs, and the live site (the password gate returns 401 to threads).

## Left alone on purpose
Do not add x10 or max buy buttons, tap clickers, third-party art or sound, a coloured strip on a panel's left edge, or pill chips and tabs. Scramble text never sticks.
