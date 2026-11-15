# Site features (non-game)

Current state of the site outside the three games with their own docs (Brasswork, Starwright, Groundbreak: see `docs/games/`). One line per feature; update the line when behaviour changes. Seeded 2026-11-15 from `integration` and the 2026-11-14 site audit (`/mnt/project-files/portfolio/site-audit-2026-11-14/site-audit.md`). Backlog: `docs/site/BACKLOG.md`.

## Access and platform
- Password gate: `proxy.ts` blocks every route behind a signed cookie (`lib/gate`). The whole site is private. Do not change without Nate.
- Deploys: only `release` builds; see `docs/deploys.md`. PR checks: `docs/ci.md`.
- Data: Supabase for Creations projects (`public.projects`, slugs match `lib/creations-data.ts`); GitHub API for History (`app/api/commits`). Accounts were dropped; Google env vars and account tables are still to be removed by Nate.
- `/dev/*` return 404 in production unless `VOXEL_BENCH=1` is set at build time; `/automation-preview` unless `AUTOMATION_PREVIEW=1`. All are preview or bench routes for the games.
- Fonts: Helvetica Neue first with Arimo as fallback, IBM Plex Mono for labels, both through `next/font/google` in `app/layout.tsx` (Next downloads and self-hosts them at build). Brasswork uses Fraunces and IBM Plex Sans via `next/font/local`; never `next/font/google` there.

## naOS shell (docs/naos.md is the source for the look)
- Page wrapper `<div className="ctos">`, `Section ctos`, `PageHead`; scoped CSS in `app/camino/ctos.css`; `body.ctos-on` set by `components/cm/ctos-body.tsx`.
- Type scale tokens (11px floor, 15px body, 18px lead) and the one-cyan-accent palette.
- Motion: scroll reveals and `Scramble`/`Slab`/`ScrollType` (`components/cm/motion.tsx`, `lib/motion/engine.ts`). Titles scramble once per hover; reduced motion shows plain text.
- Page transition: fast shutter (`app/camino/transition.css`).
- Dithered art: `NaosBackdrop` per page, header bands and washes (`components/cm/naos-art.tsx`, `scripts/naos-art/`).
- Navigation: top bar, floating dock (7 items, labels 11px on phones), site map, `/` launcher; all read `lib/nav.ts`, which also pulls games from `lib/creations-data.ts`.
- Console (backtick or Ctrl/Cmd+J): commands including `nf` for Node Farm and per-game commands. Help lists two-line entries that wrap at `|`.
- Search: `/` opens fuzzy search (`lib/search`).
- Sound: provider and engine in `components/sound-provider.tsx`, `lib/sound`; default state shown in the top bar. Audio is untested by any thread.
- Footer: shared `components/site-footer.tsx`; ID card with six contact tiles, page directory, About directory. On phones (560px and under) both directories run two across and the tiles three across (`app/camino/site-footer.css`).
- Sidebar: typed-from-code tree. Cards: one dark treatment, lowercase titles, cyan for live and hover.

## Pages
- Home `/`: hero, "Built in" (TypeScript, Three.js, JavaScript), featured work, live site stats, timeline preview, recent posts (teasers while the blog is empty).
- Home "Play" section: under the hero, three cards for Brasswork, Starwright and Groundbreak. Each is themed by `data-game` (brass, fusion red and violet, golden-hour amber), with a padded plate around a UI-free capture of a built-up save, a genre panel, the game's blurb and three short feature panels. Stacks to two columns under 1024px and one under 768px. Images are static webp in `public/home/games`, lazy-loaded; no looping captures. Code: `components/home/games-showcase.tsx`, styles at the end of `components/home/home.css`.
- About `/about`: dark cards, cyan top edge on live items, "Student", "Heading toward 2031", running stats, philosophy, education timeline, skills.
- Studies `/studies` and `/studies/[slug]`: coursework explorer, education pathway, reading queue, per-course pages.
- Timeline `/timeline`: milestones, live countdowns, journey to 2031. On phones (560px and under) milestone cards show title and date and open on tap (`.tl-hd-phone`, `.tl-ev[data-open]` in `app/timeline/timeline.css`).
- History `/history`: commit history from GitHub, live.
- Blog `/blog`, `/blog/[slug]`: category sections and post pages, driven by `lib/blog.ts`. Currently no posts; the empty page stays visible by Nate's decision. Philosophy and Politics writing will go here.
- Creations `/creations`: hub with Games, Projects, Renovations, Artwork. Featured order Nexus, Deepstack, sfvOS; grid 4 across at 1080px and up, then 2x2, then 1.
- Creations detail `/creations/[slug]`: one paragraph, meta card, tags, GitHub link (thin; see backlog). Nexus embeds playnexus.dev (public parts only), loaded behind a deferred frame.
- Renovations `/creations/renovations`, Artwork `/creations/artwork`, Projects `/creations/projects`: Renovations is empty and visible by decision; Artwork waits on Nate's pieces.
- 404 and error pages: branded.
- Share images: `opengraph-image.tsx` on `/`, about, blog, creations, creations detail, history, studies and timeline. `robots.ts` allows everything and lists the sitemap; `sitemap.ts` has only the home page. All of it sits behind the gate (decision pending, see backlog `SITE-gate-seo`).
- Also in `app`: `manifest.ts`, `loading.tsx`, `global-error.tsx`.

## Games hub and shared game code
- Hub `/creations/games`: sections Geography, Incremental, Automation; acts as a launcher. Cards use a generic glyph (see backlog).
- Leaving a game: every game has a visible "Games" link (Starwright, Groundbreak, Brasswork top bar; Node Farm page header) that lands on its own hub section (`#incremental`, `#automation`); browser back also works; Esc only closes menus.
- Shared shell `components/games/shell` (`GameRouteShell`): full-screen game routes, pause on hidden tab, hides site chrome. Save export and import: `lib/games/save.ts` (`tests/games/save.test.mjs`).
- Outline Guesser and Flag Guesser (`/creations/games/outline-guesser`, `flag-guesser`; also daily modes): daily schedule (`lib/data/daily-*.json`, built by `scripts/build-daily-schedule.mjs`), unlimited practice, neighbours round, flag round, end-of-run summary, tile-flip reveal, keyboard controls. Components in `components/games/*.tsx`.
- Node Farm `/creations/games/node-farm`: feature-complete and deployed; idle chain from Bytes to Origin with prestige tree, Ascend, Handover, zones 1 to 25, offline report, `nf` console, achievements. Full detail in `docs/node-farm.md`. Engine tests: `npm run test:nodefarm`. Sprite sheets: bump the `?v=` query when art changes. Nate's own playtest remains.
- Starwright, Groundbreak, Brasswork: per-game docs in `docs/games/`; older notes in `docs/starwright.md`.

## Checks and tooling
- Stuck-text check in PR checks (`scripts/ci/motion-stuck.mjs`): no scramble text rests as glyphs after anchor jumps, fast scrolls, tabbing or reduced motion.
- PR checks, link crawl and screenshot diff: `docs/ci.md`; scripts in `scripts/ci`.
- Engine tests for every game run in one command (`npm run test:nodefarm`).
