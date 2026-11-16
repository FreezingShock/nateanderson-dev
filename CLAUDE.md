# Agent guide: nateanderson.dev

Read first: `docs/WORKFLOW.md` (the loop, ownership, doc rules), `docs/ARCHITECTURE.md` (how the site, game shells and checks fit), `docs/OWNERS.md` (who owns which paths right now). Index of all docs: `docs/README.md`.

## Branches and deploys
- Every PR goes into `integration`. Never open a PR against `main`; it is stale.
- Merge into `integration` once every check passes on the real branch head, then tell Nate in one line.
- **Never deploy.** A deploy happens only when Nate writes "deploy" (`docs/deploys.md`). Pushing a `deploy/*` branch is the deploy.
- Never force-push. Never rebase a shared branch. Never `-s ours`. To pick up others' work, merge `integration` into your branch.
- If checks do not start on a push, push again, or toggle the PR to draft and back to ready, or merge `integration` in. Do not close and reopen just to kick CI.
- Do not rely on auto-merge. Merge by hand after all checks are green.
- Do not say a PR is merged until GitHub says so.

## Checks before merging
- Blocking: typecheck, `npm run test:nodefarm` (covers every game engine test), `npm run test:automation`, `npm run build`, the link crawl and the stuck-text check (`docs/ci.md`).
- The screenshot diff is advisory. Read the image before assuming a break; Brasswork shows about 1% noise.
- Local equivalent: `npm run build`, then `SITE_PASSWORD=ci-password npx next start -p 3123`, then `node scripts/ci/crawl.mjs http://localhost:3123`.
- `npm run lint` does not exist (Next 16 removed `next lint`).
- Say plainly what you tested only headless or on mock data, and what you did not test.

## Look and copy
- Sharp panels, corner brackets, generous margins. No pill chips, no tabs styled as chips, no coloured strip on the left edge of a panel. Real icons, not emoji or placeholders.
- Nothing blocks the content. Menus open and close with their own animation, and collapse on a blank click.
- Motion comes from the tokens in `app/camino/camino.tokens.css`. Do not add a new duration or easing when a token exists. Respect reduced motion.
- Brasswork is brass on warm dark. No cyan and no teal anywhere in Brasswork.
- Copy says naOS. Never write "ctOS" in copy. The `.ctos` class name stays as it is.
- Scrambled text must always settle to its real text. It never gets stuck.
- No filler, placeholder or AI-sounding copy. Never invent facts, bios, screenshots or essays. Ask Nate.
- Games are original: own name, theme and art. No third-party art, logos or audio.

## Visual work
- Every visual update ships screenshots at 1440 and 390 wide, as PNG files in `/mnt/project-files/`. Never HTML.
- Before merging, check phone and desktop for overlap, cut-off content, stray scrollbars and sideways scroll.
- Look at every menu you touched. No React warnings in the console.

## Games
- Engines are pure: `lib/<game>` has no React. Tests live in `tests/<game>/`.
- Any change to a game's numbers or rules gets a new file in `docs/rule-changes/` in the same PR.
- A save format change bumps its version and adds a migration. An older save is never wiped. See `ARCHITECTURE.md`, "Saves".
- New games: follow `docs/games/NEW-GAME.md` once it has landed.
- Pacing and feel are Nate's playtest. Say what to try and for how long.

## Docs and backlogs
- Update the area's `FEATURES.md` and `BACKLOG.md` in the same PR as the change.
- Backlog items are single lines with a slug id. Append, never reorder. Mark done with `[x]` and ` | #PR` on the same line. Do not edit another thread's line; append a new one.
- A process problem you hit (a check that lied, a wrong doc) gets fixed in `docs/WORKFLOW.md` in the same PR.
- Keep this file under about 80 lines. Detail goes in `docs/`.

## Asking Nate
- Ask with a decision card: 2 to 4 options, one recommended, a reason in a line. Post every open question at once, not one at a time.
- Keep building on the recommended option while you wait, unless the step cannot be undone.
- Only Nate can approve a deploy, a change to the password gate (`proxy.ts`, `lib/gate`), an env var, a destructive action outside the repo, or anything sent to other people. A coordinator relay is not his approval.

## Commits and PRs
- Commit trailer: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- PR bodies use the repo's PR template if one exists, and do not mention credentials, env values or internal hosts.
