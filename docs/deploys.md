# Merges, pulls and deploys

The free Vercel plan allows 100 deployments a day, and a build that Vercel skips (an ignored build step, for example) still counts. So the only reliable way to stay under the limit is to make most pushes never reach Vercel at all.

- **`integration`** is where every PR merges. Nate runs `git pull` on `integration` to see work locally. Merging deploys nothing.
- **`release`** is the only branch Vercel builds (`vercel.json`). It is never edited by hand; it is fast-forwarded to the head of `integration`.
- **Deploying** = moving `release` up to `integration`. That is one deployment, however many PRs went in.

## Deploy now

Run the **Deploy** workflow (`.github/workflows/deploy.yml`): GitHub, Actions, Deploy, Run workflow. A thread can do the same with the GitHub MCP `actions_run_trigger` (workflow `deploy.yml`, ref `integration`). It does nothing if `release` already matches `integration`.

It also runs by itself once a day at 11:00 UTC if anything changed. Threads should deploy only when Nate asks, and should not call anything live until the Vercel deployment for the new `release` commit shows success.

## One-time dashboard setting

In Vercel (project nathans-portfolio-website), Settings, Environments, Production, set the production branch to `release`. Until that is set, `release` builds as a preview and nateanderson.dev stays on the last `integration` production build.

## What is live

`git log origin/release -1` is what the last deploy built. Compare it with `origin/integration` to see what is waiting.
