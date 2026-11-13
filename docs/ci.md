# PR checks

`.github/workflows/pr-checks.yml` runs on every pull request into `integration` or `main`. It runs in GitHub Actions, so it uses no Vercel deployments.

| Check | Blocks the PR? | What it does |
|---|---|---|
| Typecheck | yes | `tsc --noEmit` |
| Node Farm engine tests | yes | `npm run test:nodefarm` (about 25 s): saves, resets, zone order, no NaN, tick size. See `docs/node-farm.md` ("Engine tests"). Runs in the same job as Typecheck, Build and Link crawl, so it is part of the existing required check. |
| Build | yes | `npm run build` |
| Link crawl | yes | Starts the built site, signs in through the password gate, follows every internal link, image and script from `/` and every static route, and fails on any 4xx/5xx. External links are not checked. |
| Screenshot diff | no (advisory) | Builds the PR and its base branch, screenshots every route at 1440 and 390 wide, and comments which pages changed by 0.5% of pixels or more. Diff images are in the `screenshot-diff` artifact. |

The CI site uses a throwaway `SITE_PASSWORD`, so no secrets are needed. Nothing here touches the real gate.

Run locally (after `npm run build`):

```
SITE_PASSWORD=ci-password npx next start -p 3123 &
SITE_PASSWORD=ci-password node scripts/ci/crawl.mjs http://localhost:3123
```

Screenshots need `cd scripts/ci && npm install && npx playwright install chromium` first. They freeze CSS animations and use reduced motion, so pages with random content (the guessers) can show small false diffs.
