# PR checks

`.github/workflows/pr-checks.yml` runs on every pull request into `integration` or `main`. It runs in GitHub Actions, so it uses no Vercel deployments.

| Check | Blocks the PR? | What it does |
|---|---|---|
| Typecheck | yes | `tsc --noEmit` |
| Node Farm engine tests | yes | `npm run test:nodefarm` (about 25 s): saves, resets, zone order, no NaN, tick size. See `docs/node-farm.md` ("Engine tests"). Runs in the same job as Typecheck, Build and Link crawl, so it is part of the existing required check. |
| Build | yes | `npm run build` |
| Link crawl | yes | Starts the built site, signs in through the password gate, follows every internal link, image and script from `/` and every static route, and fails on any 4xx/5xx. External links are not checked. |
| Stuck-text check | yes | `scripts/ci/motion-stuck.mjs`, after the link crawl in the same job. In Chromium on the built site, at 1440 and 390 (plus reduced motion at 1440), it jumps to in-page anchors, scrolls fast to the bottom and back, and tabs through the page. Every on-screen `data-final` text must show its real text within 3 s, and at once under reduced motion. Each check polls until the text has settled or the deadline passes (no single check after a fixed wait), so a slow runner cannot fail it; the job step takes about 2 min. `scripts/ci/scramble.mjs` is the slower, deeper hover and scroll hammer (about 10 min); run it by hand after changing `lib/motion/engine.ts`. |
| Screenshot diff | no (advisory) | Builds the PR and its base branch, screenshots every route at 1440 and 390 wide, and comments which pages changed by 0.5% of pixels or more. Diff images are in the `screenshot-diff` artifact. |

The CI site uses a throwaway `SITE_PASSWORD`, so no secrets are needed. Nothing here touches the real gate.

Run locally (after `npm run build`):

```
SITE_PASSWORD=ci-password npx next start -p 3123 &
SITE_PASSWORD=ci-password node scripts/ci/crawl.mjs http://localhost:3123
```

Screenshots need `cd scripts/ci && npm install && npx playwright install chromium` first. They freeze CSS animations and use reduced motion, so pages with random content (the guessers) can show small false diffs.

Known noise: the Groundbreak pages show live game state (stock counts, workers, the first-minute run), so a PR that changes the engine or the start state, such as #534, shows a 1 to 5% diff with no art change. `phone__creations-games-brasswork` shows about 1% on most PRs (animated scene) even when the PR does not touch it. Read the diff image before assuming a PR broke a page.


## Groundbreak HUD check

Before merging a change to the Groundbreak HUD, dock, cue or windows, run `node scripts/ci/gb-hud.mjs http://localhost:3123 out-dir` against a production build (`SITE_PASSWORD=ci-password npx next start -p 3123`). It opens the game at 1440x900, 390x844, 360x740, 375x667, 844x390, 932x430 and 667x375, exits 1 if the cue, zoom buttons, dock, feed, job card or rail overlap, and saves a PNG per size. Not a PR check yet.
