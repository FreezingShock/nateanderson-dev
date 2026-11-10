# Merges, pulls and deploys

The free Vercel plan allows 100 deployments a day, and a build that Vercel skips (an ignored build step, for example) still counts. So the only reliable way to stay under the limit is to make most pushes never reach Vercel at all.

- **`integration`** is where every PR merges. Nate runs `git pull` on `integration` to see work locally. Merging deploys nothing.
- **`release`** is the only branch Vercel builds (`vercel.json`). It is never edited by hand; each deploy adds one commit to it with the same files as `integration`.
- **Deploying** = updating `release` to match `integration`. That is one deployment, however many PRs went in.

## Deploy now

Push a branch named `deploy/<anything>`. The **Deploy** workflow (`.github/workflows/deploy.yml`) updates `release` to match `integration` and deletes the trigger branch. A thread can create it with the GitHub MCP `create_branch` (branch `deploy/now`, from `integration`); from a terminal it is `git push origin integration:refs/heads/deploy/now`. If `release` already has the same files as `integration`, nothing is deployed.

Threads deploy only when Nate asks, and should not call anything live until the Vercel deployment for the new `release` commit shows success (`gh api repos/FreezingShock/nateanderson-dev/deployments`).

A daily automatic batch and a "Run workflow" button would need the workflow on the default branch (`main`). Making `integration` the default branch in GitHub settings would allow both.

## One-time dashboard setting

In Vercel (project nathans-portfolio-website), Settings, Environments, Production, set the production branch to `release`. Until that is set, `release` builds as a preview and nateanderson.dev stays on the last `integration` production build.

## What is live

`git log origin/release -1` is what the last deploy built. Compare it with `origin/integration` to see what is waiting.
