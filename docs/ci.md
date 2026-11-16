# PR checks

`.github/workflows/pr-checks.yml` runs on every pull request into `integration` or `main`. It runs in GitHub Actions, so it uses no Vercel deployments.

| Check | Blocks the PR? | What it does |
|---|---|---|
| Typecheck | yes | `tsc --noEmit` |
| Node Farm engine tests | yes | `npm run test:nodefarm` (about 25 s): saves, resets, zone order, no NaN, tick size. See `docs/node-farm.md` ("Engine tests"). Runs in the same job as Typecheck, Build and Link crawl, so it is part of the existing required check. |
| Build | yes | `npm run build` |
| Link crawl | yes | Starts the built site, signs in through the password gate, follows every internal link, image and script from `/` and every static route, and fails on any 4xx/5xx. External links are not checked. |
| Stuck-text check | yes | `scripts/ci/motion-stuck.mjs`, after the link crawl in the same job. In Chromium on the built site, at 1440 and 390 (plus reduced motion at 1440), it jumps to in-page anchors, scrolls fast to the bottom and back, and tabs through the page. Every on-screen `data-final` text must show its real text within 3 s, and at once under reduced motion. Each check polls until the text has settled or the deadline passes (no single check after a fixed wait), so a slow runner cannot fail it; the job step takes about 2 min. `scripts/ci/scramble.mjs` is the slower, deeper hover and scroll hammer (about 10 min); run it by hand after changing `lib/motion/engine.ts`. |
| Game checks | yes | `scripts/ci/checks/run.mjs all`, after the stuck-text check. One config-driven runner for the windowed game panel (Brasswork, Starwright, Groundbreak), the framed game route (Node Farm), and the Groundbreak HUD at seven sizes with a fresh and a late save. About 6 min. Results and failing screenshots are in the `game-checks` artifact. See "Game checks" below. |
| Screenshot diff | no (advisory) | Builds the PR and its base branch, screenshots every route at 1440 and 390 wide (`scripts/ci/checks/run.mjs shots` and `diff`), and comments which pages changed by 0.5% of pixels or more. Diff images are in the `screenshot-diff` artifact. |

The CI site uses a throwaway `SITE_PASSWORD`, so no secrets are needed. Nothing here touches the real gate.

Run locally (after `npm run build`):

```
SITE_PASSWORD=ci-password npx next start -p 3123 &
SITE_PASSWORD=ci-password node scripts/ci/crawl.mjs http://localhost:3123
```

Screenshots need `cd scripts/ci && npm install && npx playwright install chromium` first. They freeze CSS animations and use reduced motion, so pages with random content (the guessers) can show small false diffs.

Known noise: the Groundbreak pages show live game state (stock counts, workers, the first-minute run), so a PR that changes the engine or the start state, such as #534, shows a 1 to 5% diff with no art change. `phone__creations-games-brasswork` shows about 1% on most PRs (animated scene) even when the PR does not touch it. Read the diff image before assuming a PR broke a page.


## Game checks

One runner, `scripts/ci/checks/run.mjs`, runs the browser checks for the games against a production build. It replaces the old window, shell and Groundbreak HUD scripts, and it keeps every assertion they made.

```
cd scripts/ci && npm install && npx playwright install chromium && cd ../..   # once
SITE_PASSWORD=ci-password SITE_GATE_SECRET=x npx next start -p 3123           # after npm run build
node scripts/ci/checks/run.mjs all http://localhost:3123 game-checks           # or: npm run check:games
```

Suites: `window` (the windowed panel at 1440, 390 and 1366x657), `shell` (the framed game route at 390 and 1440, the hidden tab, full screen, saves, the manifest and the hub), `hud` (the Groundbreak HUD at seven sizes, with the fresh and the late save). Pick one with `npm run test:window`, `test:shell` or `test:hud`, or name a comma list. `--game groundbreak` limits the per-game checks to one game. Exit 1 on any failure. With an out dir it writes `results.json`, `summary.md` and the screenshots per suite.

**Adding a game to the checks.** Games from `npm run new-game` need nothing here: the generator lists them in `scripts/games/games-under-check.json`, and `games.mjs` reads that list (`template: true` also runs the template's tap and error checks). A hand-made game adds one `registerGame({...})` call to `scripts/ci/checks/games.mjs`. The fields are documented in `scripts/ci/checks/registry.mjs`:

- `id` (route slug, `/creations/games/<id>`) and `name` (the `data-game` name the shell writes).
- `window: { root }` for a windowed game: the CSS selector of the game's fixed root, which must fill the panel. Optional `views`.
- `hud: { seeds, sizes }` for a game with a HUD worth checking at seven sizes. `seeds` is a list of `{ label, save }`; `save` is a save file under `scripts/ci/`, so the late game with big numbers is checked too. Optional `sizes` as `[[w, h], ...]`.
- `shell: { gameSelector, saveKey, headerRoute }` for a framed game: a selector that proves the game rendered, the save key it writes, and optionally a route with the compact header.

Defaults: windowed games get the three windowed views, the HUD gets the seven standard sizes and a fresh seed. Every game needs at least one of `window`, `hud` or `shell`. `registerGame` throws on a bad id, a duplicate id or a missing selector, so a typo fails in the first run, not in a silent skip.

**What each suite checks** (the list is in the header of each file under `scripts/ci/checks/suites/`):

- `window`: the panel mounts and fills its root; on desktop the Play section starts below the site bar and the panel and footer fit above the dock; on a short desktop the title bar starts below the site bar; the panel is tall enough and takes focus on load; game keys and the wheel over the panel do not scroll the page; the wheel over the title bar does; no sideways scroll; Export save answers; Import refuses a file that is not a save; no page errors. The hub stays a plain page. A phone panel can be most of the screen, so the key check starts at the most room the page has, and the title-bar check wheels down when the page is at the top (PR 664). Brasswork on a phone is full screen, so its title-bar and Export checks are skipped there (the elements are not on the page).
- `shell`: at 390 and 1440 the shell mounts, the game route is marked, the page does not scroll sideways, the board renders, pull-to-refresh and bounce are off, and there are no page errors; the save key is written with the shell mounted; the hidden tab fires visibility and pause events and the shell reports paused, then clears; full screen toggles on desktop; the manifest has two shortcuts; a header route's controls are at least 44 px tall on a phone and Pause toggles.
- `hud`: no HUD parts overlap (cue, zoom, dock, feed, job card, rail) at each size; at 390 a card on load and each rail window leave at least 40% of the scene free and never cover its centre; at 390 and 1440 no currency chip is cut off, runs past its top bar, its chip row or the screen. A PNG per seed and size goes to the out dir.

**Known state (2026-11-16).** On `integration` today the late Groundbreak seed fails the HUD at 1440 x 900: the zoom column overlaps the job card. PR 664 (`claude/project-thread-52dee6`, still a draft) fixes that overlap in `app/camino/groundbreak.css`. Merged onto current `integration`, its head 75f1eb6a passes all 167 checks of this runner. Until 664 merges, the Game checks step fails on that one overlap in every PR. The window suite's two Groundbreak phone checks (keys and title bar) assumed 120 px of scroll room, which a phone panel does not leave; the suite now starts at the most room the page has, as PR 664's script change did, so PR 664's `scripts/games/window-check.mjs` edit is superseded by this runner. Headless Chromium only: Safari, real phones and a real GPU are not tested here.

## Screenshot diff

`scripts/ci/checks/run.mjs shots <base> <out>` screenshots every route at 1440 and 390 with CSS animations frozen, from the repo root of the build being served (it reads that build's `.next` manifests). `run.mjs diff <base-dir> <head-dir> <diff-dir>` writes the diff images and `summary.md`. Both are advisory and always exit 0.

Known noise: the Groundbreak pages show live game state (stock counts, workers, the first-minute run), so a PR that changes the engine or the start state, such as #534, shows a 1 to 5% diff with no art change. `phone__creations-games-brasswork` shows about 1% on most PRs (animated scene) even when the PR does not touch it. Read the diff image before assuming a PR broke a page.

## Files

- `scripts/ci/checks/run.mjs`: the CLI. `registry.mjs`: `registerGame`, the defaults and validation. `games.mjs`: the game configs. `kit.mjs`: browser, gate cookie, the report and page helpers.
- `scripts/ci/checks/suites/`: `window.mjs`, `shell.mjs`, `hud.mjs`, `shots.mjs`, `diff.mjs`.
- `scripts/ci/seeds/groundbreak-late.json`: the late Groundbreak save (about 3 h, 13 jobs, 12 materials). Made by the overhaul thread's `make-seed.mjs`.
- `scripts/ci/lib.mjs`: the password gate and the server wait, shared with the link crawl and the stuck-text check.
