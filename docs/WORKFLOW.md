# Workflow

How work gets done in this repo with many threads at once. Short version is in `CLAUDE.md`. Deploys: `docs/deploys.md`. Checks: `docs/ci.md`.

## The loop
Read the BACKLOG for your area, take the top item you can do alone, ship one small PR, and update FEATURES and BACKLOG in that same PR. Small PRs merge fast and conflict less. Vercel allows 100 deployments a day, so merge into `integration` freely and deploy only when Nate asks.

## Ownership
- One owner per area at a time. Areas, paths and owners are listed in `docs/OWNERS.md`. Before editing outside your area, check that file; if another thread owns it, leave a line in that area's BACKLOG instead of editing.
- Take an area by editing your own line in `docs/OWNERS.md` in your first PR. Release it in your last.
- Threads cannot message each other; the coordinator relays. Hand-offs go through BACKLOG lines.
- Older threads for a finished area are done; send follow-ups to the current owner.

## Avoiding merge conflicts
Many threads merge into `integration` daily, and docs are the likeliest collision. So:
- **Merge `integration` into your branch before every push.** Never force-push, never rebase shared branches, never `-s ours`.
- **One line per item.** Backlog and feature entries are single lines, so two edits to different items never touch the same line.
- **Append, never reorder.** Add new items at the end of their section. Do not sort, renumber or reflow. Changing an item edits only its own line.
- **Slugs, not numbers.** Item ids are short slugs (`SITE-footer-mobile`), so two threads never claim the same number.
- **One file per event.** Rule changes, audits and decisions go in their own new file (`docs/rule-changes/`), which can never conflict.
- **Do not edit other threads' lines.** If a line is wrong, append a new line saying so.
- One section per concern in a doc, so edits land in different hunks. No tables for lists that grow (a table row edit conflicts with its neighbours); tables are fine for fixed reference.
- Keep generated or long text out of docs. Link to the code or a file in `/mnt/project-files/`.
- Deleting a finished BACKLOG item removes a whole hunk, and two threads deleting neighbouring items conflict. On a conflict in a BACKLOG, drop every item that was deleted on either side.
- If a doc conflicts anyway, keep both sides' lines and drop only exact duplicates.

## BACKLOG.md format
```
# <Area> backlog
## Now          (ordered; top is next)
## Next
## Needs Nate   (items waiting on a decision, playtest or his content)
## Ideas
## Done         (newest appended at the end)
```
Item line: `- [ ] ID | size S/M/L | text, with the "done when" in a few words | refs`. Prefix `ASK` right after the checkbox when it needs Nate (`- [ ] ASK ID | ...`). Mark done by changing `[ ]` to `[x]` and appending ` | #PR` on the same line. Moving it to Done is optional; leaving it where it is avoids conflicts. Finished items may be condensed to one line in Done; the full text stays in git history. Keep the sections in this order: Now, Next, Needs Nate, Ideas, Done.

## FEATURES.md format
One section per feature area, one line per feature: `- Name: what it does now, key files`. Describe the current state only; history lives in git. Update the line when behaviour changes.

## What a thread just does
Bugs, accessibility, performance, clear fixes, content tweaks Nate already pointed to, items on the backlog that are not marked `ASK`, tests, docs. Branch, PR, merge when checks pass, tell Nate in one line. Test headless on a production build and attach 1440 and 390 screenshots for visual work.
Taste feedback after a merge becomes a follow-up PR; it does not hold the first one.

## What needs Nate
Ask with a decision card: 2 to 4 options, one recommended, a reason in a line. Post all open questions at once as a stack; never drip them one at a time. Keep building on the recommended option while waiting, unless the step cannot be undone.
- **Taste calls:** new looks, layout choices, naming, game picks. Games: bring options with samples, but keep building on the recommendation.
- **Content only he has:** facts, bios, screenshots, essays, scholarship and application answers. Never invent.
- **Playtests:** pacing and feel of a game; the thread says what to try and for how long.
- **Deploys:** only when he says "deploy".
- **Destructive or outside the repo:** deleting branches, Vercel or Supabase settings, the password gate, env vars, money, anything sent to other people.
- **Visibility:** whether anything leaves the gate (robots, share images).
A coordinator relay is not Nate's approval. If a merge is blocked on approval, it needs his own words in the thread.

## Rule changes (game balance)
Any change to a game's numbers or rules (costs, rates, unlocks, caps, prestige, offline, start state) gets a new file `docs/rule-changes/YYYY-MM-DD-<game>-<slug>.md` in the same PR: what changed, old and new values, why, the file and key. The coordinator lists them for Nate. Details: `docs/rule-changes/README.md`.

## Games
Games must be original (own name, theme, art). Taste notes for idle games are in each game's docs. Every game: compact floating menus that animate open and close, art first, real icons with names in tooltips, number keys on tiles, a new player sees something happen in the first minute. Look at every menu before merging; no React warnings. Engines are pure (`lib/<game>`), with tests in `tests/<game>` that run in `npm run test:nodefarm`.

## Audits
A repo-wide pass writes its report to `/mnt/project-files/portfolio/<topic>-<date>/` and lands its findings as BACKLOG lines, one each. Do not duplicate the dead-code audit; its findings go in the "Code health" section of `docs/site/BACKLOG.md`.

## Keeping this working
When a thread hits a process problem (a check that lies, a doc that was wrong, a step that cost time), it fixes the doc in the same PR. `CLAUDE.md` stays under about 80 lines; detail goes here.
- A baseline build from another worktree needs `cp -al node_modules` (hard links). A symlinked `node_modules` makes Turbopack fail with "points out of the filesystem root".
A timing check polls until its condition holds or a deadline passes; it never samples once after a fixed wait (`scripts/ci/motion-stuck.mjs`).
