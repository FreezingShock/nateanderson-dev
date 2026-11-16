# Architecture

How the site, the game shells and the checks fit together. Read this before touching routing, styling or a game shell. Short rules for agents are in `CLAUDE.md`; the file map of each area is in `docs/OWNERS.md`; the backlog format is in `docs/WORKFLOW.md`.

Stack: Next.js 16 (App Router, Turbopack for dev), React 19, TypeScript, Tailwind v4 (CSS-first, no `tailwind.config`), Three.js for Brasswork, Supabase (`lib/supabase.ts`, used only by `lib/content.ts`), Vercel for hosting. Node 22 in CI.

## 1. Routes

Everything lives under `app/`. Each route folder has a `page.tsx`; most also have `opengraph-image.tsx` for the share preview.

| Route | Source | Notes |
| --- | --- | --- |
| `/` | `app/page.tsx` | Homepage: hero, Play band (animated game art), recent work |
| `/about`, `/timeline`, `/studies`, `/studies/[slug]`, `/history`, `/blog`, `/blog/[slug]`, `/system` | `app/<name>/` | Non-game pages. `/history` reads GitHub commits through `app/api/commits` |
| `/creations` | `app/creations/page.tsx` | Creations index. Sub-pages: `projects`, `renovations`, `artwork`, and `[slug]` for detail pages |
| `/creations/games` | `app/creations/games/page.tsx` | Games hub, three sections: Geography, Incremental, Automation |
| `/creations/games/<game>` | `app/creations/games/<game>/` | One folder per playable game (see section 4). Guessers: `outline-guesser`, `flag-guesser` |
| `/creations/games/daily-outline`, `/daily-flag` | `next.config.ts` redirects | Permanent redirects to the guessers' Daily tab |
| `/dev/*`, `/automation-preview` | `app/dev`, `app/automation-preview` | Art and test pages for development. Not linked from the site |
| `/api/gate` | `app/api/gate/route.ts` | The only path reachable without the unlock cookie |

Metadata for games comes from `lib/games/registry.ts` (`gameMetadata`), so a title and share preview are written once. Site-wide SEO helpers are in `lib/seo.ts`; `app/robots.ts`, `app/sitemap.ts` and `app/manifest.ts` are generated from them.

### The password gate

`proxy.ts` (the Next 16 `proxy` convention) runs before every route, asset and API call. A visitor without a valid signed cookie gets the small gate page with status 401 and nothing else. The cookie is `site_unlock` (`lib/gate/config.ts`), HttpOnly and signed by `lib/gate/token.ts`.

Environment variables read by the gate:
- `SITE_PASSWORD` (plain text), or `SITE_PASSWORD_SHA256` (its hex digest, so the plain text is not stored)
- `SITE_GATE_SECRET` (signs the cookie)

Warning: `lib/gate/config.ts` has a built-in fallback password for when `SITE_PASSWORD` is unset. The repository is public, so that fallback is visible to anyone who reads the source. Production must set `SITE_PASSWORD` or `SITE_PASSWORD_SHA256` in Vercel. Changing the gate is a decision for Nate (`docs/WORKFLOW.md`, "What needs Nate").

CI uses a throwaway `SITE_PASSWORD=ci-password` and never touches the real one (`docs/ci.md`).

## 2. Styling

Global CSS is imported once from `app/globals.css`, in this order. The order matters: later sheets win on equal specificity.

1. `tailwindcss` (utilities; Tailwind v4 reads `@theme` blocks in CSS)
2. `app/camino/camino.tokens.css`: colour, type, spacing and the motion scale (below)
3. `camino.components.css`, `site.css`, `motion.css`, `transition.css`
4. `ctos.css`, `nav-naos.css`, `icons-naos.css`, `naos-surfaces.css`, `site-footer.css`, `naos-scroll.css`, `entrances.css`, `micro.css`, `site-motion.css`

Game CSS is not global. Each game's layout imports its own sheets, so a game's rules only load on its routes:
- Brasswork: `app/camino/brasswork.css` (plus `components/automation/*.css` and `components/brasswork/*.css` imported by their components)
- Starwright: `app/camino/starwright*.css`
- Groundbreak: `app/camino/groundbreak.css`
- Node Farm: `app/camino/nodefarm/*.css`
- Guessers and hub: `app/camino/games.css`
- Shared game shell: `app/camino/game-shell.css`, launch cover: `app/camino/game-launch.css`

Brasswork and Node Farm ship the largest CSS and JS. Splitting them is tracked in `docs/site/BACKLOG.md` (SITE-nodefarm-css-split, SITE-speed-game-css).

### Tokens

All tokens use the `--cm-*` prefix and live on `:root` in `camino.tokens.css`.
- **Colour:** `--cm-void` (page ground), `--cm-fg` / `--cm-mute` / `--cm-dim` (text), `--cm-paper` (white plates), `--cm-cyan` (the one accent for "live" and primary action), `--cm-alert`, `--cm-amber`, `--cm-good`. Use cyan on about 5% of a screen.
- **Surfaces:** `--cm-glass`, `--cm-solid`, `--cm-hair` (1px borders).
- **Type:** `--cm-display` (Arimo) and `--cm-mono` (IBM Plex Mono), with size steps `--cm-t-*` (for example `--cm-t-micro` 9px for mono caps).
- **Motion scale:** one set, used by buttons, chips, cards, page shutters and the games.
  - Easing: `--cm-ease` (hover, colour, enter), `--cm-ease-out` (reveals, landings), `--cm-ease-cut` (wipes, panels, shutters), `--cm-ease-press` (press and lift, a small settle with no overshoot on collapse).
  - Durations: `--cm-d-instant` (press), `--cm-d-fast` (tips, colour), `--cm-d-base` (hover borders), `--cm-d-enter` (menus and panels), `--cm-d-shut` and `--cm-d-exit` (page shutters), `--cm-d-name` (page title), `--cm-d-wipe`, `--cm-d-reveal`, `--cm-d-count`, `--cm-d-slow`, `--cm-d-long`.
  - Travel: `--cm-lift` (hover rise, 2px) and `--cm-press` (press scale .985). Use these, not new numbers.
  - Reduced motion: one rule in `camino.tokens.css` sets every duration to .01s and the travel to `none`.

Do not hard-code a duration or easing in a component when a token exists. The rules for the motion system, including `data-mx` reveals and the page curtain, are in `MOTION.md`.

### naOS

The site's surveillance-OS look is scoped under `.ctos`. Wrap a page in `<div className="ctos">`; `body.ctos-on` switches on the naOS footer and page-end bar (`components/cm/ctos-body.tsx`). Details and the dither-art rules: `docs/naos.md`.

Brasswork has its own palette: brass and warm dark, with no cyan and no teal. Recolouring a Brasswork window from teal to brass was done in #677; keep it that way.

## 3. Site shell and motion

- `app/layout.tsx` mounts the shared chrome: top bar (`components/cm/bar.tsx`), dock, console (`components/cm/console*.tsx`, opened with a backtick or Ctrl/Cmd+J, search with `/`), site map, keyboard help, the boot sequence, and the footer (`components/site-footer.tsx`).
- `lib/motion/engine.ts` is the one runtime for scroll reveals, scramble text and typed lines. It is started by `components/cm/motion-root.tsx`. It follows the OS motion setting live.
- Text that scrambles must always settle to its real text. CI checks this (section 6).
- Sound: `lib/sound/` is the site sound engine (`components/sound-provider.tsx`). Each game can add its own sound on top; Brasswork's is in `lib/automation/audio`, Starwright's in `lib/starwright/sound.ts`.

## 4. Games

### Where each game lives

| Game | Route | Engine (pure, no React) | Components | Shell mode |
| --- | --- | --- | --- | --- |
| Brasswork (3D automation) | `/creations/games/brasswork` | `lib/automation/sim`, `lib/automation/models`, `lib/automation/render`; `lib/brasswork` for fonts and settings | `components/automation`, `components/brasswork`, `components/brasswork-ui` | windowed |
| Starwright (star fusion idle) | `/creations/games/starwright` | `lib/starwright/engine.ts` (plus `data`, `session`, `settings`) | `components/starwright` | windowed |
| Groundbreak (construction idle) | `/creations/games/groundbreak` | `lib/groundbreak/engine.ts` | `components/groundbreak` | windowed |
| Node Farm (idle, prestige) | `/creations/games/node-farm` | `lib/nodefarm/engine.ts` | `components/nodefarm` | framed |
| Outline and Flag Guesser | `/creations/games/outline-guesser`, `/flag-guesser` | `lib/outline-game.ts`, `lib/data` | `components/games/*.tsx` | `GameFrame` (own page) |

Brasswork's Three.js code only loads inside its route (`components/brasswork`).

### The game shell

`components/games/shell/game-route-shell.tsx` is the one shell every game route uses. A game opts in from its `layout.tsx`:

- **Windowed** (Brasswork, Starwright, Groundbreak): the route is a normal site page with an intro. The game runs in a large panel with a title bar. On load the page scrolls the Play section under the site bar, and the panel takes focus. While the game has focus, game keys and the wheel stay with it.
- **Framed** (Node Farm): the page is the game's own page. The shell adds only the hooks below.

Both modes do the same things and nothing else:
- mark the page as a game route (`html.gs-game-route`, stops overscroll and pull-to-refresh)
- publish tab visibility as the window event `gameshell:visibility` (`{ hidden }`)
- publish a manual pause as `gameshell:pause`; a hidden tab counts as paused
- full screen for the panel or the shell box, where the browser supports it
- export and import the save for games in `SAVE_SLOTS`

The shell never changes game state. A game listens for the events if it wants to pause its loop.

A game's route folder has a `layout.tsx` (shell) and a `page.tsx` (metadata and the game's host component). `app/creations/games/layout.tsx` adds only the launch cover, which runs across route changes.

### Game registry

`lib/games/registry.ts` holds one `GAMES` record: name, route, the hub eyebrow (which section the game sits in), description, play-section heading, theme (`brass`, `star`, `ground`, `node`), and the back link. Pages and the shell read from it. A game is added to the Games hub (`lib/creations-data.ts`) only when it is playable; no placeholder cards.

### Saves

Shared save code is in `lib/games/`:
- `save.ts`: `createSaveTools()` builds the file format. A save file is an envelope `{ app, version, savedAt, data }`. Files over 2 MB, from a newer version, or that fail the game's validator are refused with a reason. Nothing is written until the whole file has passed.
- `save-slot.ts`: `SAVE_SLOTS` maps each game to its localStorage key, app id and version. Current slots: `brasswork-save-v1`, `sw-save-v1` (Starwright), `gb-save-v1` (Groundbreak, version 2). Import never writes straight to storage. It keeps the current save as `<key>:before-import`, stages the new one in sessionStorage, reloads, and applies it before the game reads its save. Writing first would let the old state overwrite the import on `pagehide`.
- Node Farm is not in `SAVE_SLOTS`. It keeps its own local save and export code in `lib/nodefarm/`.

Changing a save's shape means bumping its version and writing a migration. A save that loads from an older version must never be wiped. The save system and game kit are being unified in sibling threads; their docs are linked from `docs/README.md` when they land.

### Tests

- `npm run test:nodefarm` runs every game engine test in `tests/` (`nodefarm`, `games`, `automation`, `starwright`, `groundbreak`). The name is historical; it covers all games. It is a PR check.
- `npm run test:automation` runs the Brasswork input tests. It is also a PR check.
- `npm run check:automation` checks the Brasswork recipes.
- Browser checks, run by hand against a production build: `scripts/games/window-check.mjs` (windowed panels), `scripts/games/shell-check.mjs` (shell, Node Farm, Games hub), `scripts/ci/gb-hud.mjs` (Groundbreak HUD overlap at seven sizes). Not PR checks yet.

Every game balance or rule change gets a file in `docs/rule-changes/` (see `docs/rule-changes/README.md`).

## 5. Art

- Site art in `public/naos/` is 1-bit dither art, generated by scripts under `scripts/naos-art/`. Its cache is a week; a regenerated file keeps its name, so the window is short on purpose.
- Game art: Brasswork models and textures under `lib/automation/art` and `lib/automation/models`; Starwright sprites via `lib/starwright/sprites.ts` and `ui-sheets.ts`; Groundbreak icons via `components/groundbreak/icons.ts`; Node Farm sprite sheets, which get a `?v=` bump when they change.
- Every game's art is original. No third-party art, logos or audio.

## 6. Checks and CI

Full table in `docs/ci.md`. In short, `.github/workflows/pr-checks.yml` runs on every pull request into `integration` or `main`:

- **Typecheck, build, link crawl** (blocks): `tsc --noEmit`, `npm run test:nodefarm`, `npm run test:automation`, `npm run build` (its `prebuild` runs the Node Farm art stamp check), the link crawl (`scripts/ci/crawl.mjs`, logs in through the gate and follows every internal link), and the stuck-text check (`scripts/ci/motion-stuck.mjs`).
- **Screenshot diff** (advisory): builds the PR and its base, screenshots each route at 1440 and 390, and comments which pages changed by 0.5% or more. Animated pages (especially Brasswork) show small noise, so read the diff image before assuming a break.

`npm run lint` does not exist. `next lint` was removed in Next 16, and no replacement is configured.

## 7. Branches and deploys

```
task branch --PR--> integration  (checks must be green; merge; deploys nothing)
                       |
                       | Nate says "deploy"
                       v
           deploy/now  (push from integration)  --Deploy workflow-->  release  --Vercel-->  nateanderson.dev
```

- `integration` is where every PR merges. Nate runs `git pull` on it to see work locally.
- `release` is the only branch Vercel builds. `vercel.json` turns off deployments for every other branch. Nothing edits `release` by hand.
- A deploy is one push of a `deploy/*` branch. `.github/workflows/deploy.yml` makes `release` match `integration` and deletes the trigger branch. One deploy covers every PR merged since the last one. Vercel allows 100 deployments a day, so batch.
- `main` is stale and is not the production branch.

Full steps and the Vercel setting that makes `release` the production branch: `docs/deploys.md`.

## 8. Ownership and docs

- `docs/OWNERS.md`: who owns which paths right now. Take an area by editing your own line.
- `docs/WORKFLOW.md`: how threads work in parallel, one line per backlog item, append-only edits.
- `CLAUDE.md`: the agent guide (rules for branches, checks, visual work, games, backlogs). `AGENTS.md` holds Next's managed block and points to it. Both are tracked; they were gitignored until 2026-11-16.
- `docs/README.md`: the index of every doc.
- Backlogs: `docs/site/BACKLOG.md` for the site and `docs/games/<game>/BACKLOG.md` for each game. Features: `FEATURES.md` next to each backlog.
- Per-game design notes: `docs/naos.md`, `docs/node-farm.md`, `docs/starwright.md`, `MOTION.md`.

## 9. Known gaps

- Safari and iPhone full screen: not tested in the cloud (`SHELL-webkit`, `SHELL-phone-touch` in the site backlog).
- Build size: Brasswork and Node Farm ship large CSS and JS bundles (`SITE-speed-*` items).
- Save export and import are still wired separately inside the Starwright and Groundbreak menus instead of through `lib/games/save-slot.ts` (`SHELL-saves-one-path`).
