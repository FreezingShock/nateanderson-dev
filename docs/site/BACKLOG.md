# Site backlog (non-game)

Format and rules: `docs/WORKFLOW.md`. Append new items at the end of a section; mark done by `[x]` and `| #PR` on the same line. `ASK` means it needs Nate first. Seeded 2026-11-15 from the site audit (`/mnt/project-files/portfolio/site-audit-2026-11-14/site-audit.md`, numbers in brackets) and project memory. Already fixed since the audit: console help wrapping and 11px dock labels (e03b1748), preload warnings and Nexus load time (#483).

## Now
(open, ordered: top is next and not waiting on Nate)
- [x] SITE-contrast | S | measure contrast of dim mono labels against the dithered backgrounds (needs a sampled-pixel check, not a CSS colour check) and lift any under 4.5:1 | claude/site-polish-taps-contrast: --cm-dim lifted to #88979e (Nate chose a site-wide lift, 2026-11-17)
- [ ] SITE-nodefarm-css-split | L | split Node Farm CSS so panels load on first open: about 290 KB of rules use classes that several modules share, so each split needs a class-ownership pass first | docs/node-farm.md CSS notes
- [ ] SITE-timeline-overview-phone | S | Timeline is still about 9,400 px at 390; the overview section is 2,038 px and the live phase 2,938 px; trim the overview to reach the 7,000 px target | audit 6
- [ ] SITE-studies-mobile | M | Studies is 9,400 px at 390 (classes 2,398, reading 1,083, pathway 1,280); same short-card treatment
- [ ] SITE-creations-detail | M | hero image, short build story, stack and role block, screenshots on each detail page | audit 2 | needs Nate's facts, see below
- [x] SITE-speed-transitions | S | route loading card now centred on the viewport (its 450 ms delay never applied: `.ctos .sys-load` did not match the element); nav and game routes warmed when idle (game routes skipped on save-data or 2g/3g); game launch cover 420 to 260 ms | this PR
- [x] SITE-games-fill-screen | S | game panels fill more of the screen on every game: desktop anchors on the panel title bar (the Play heading scrolls up), frame is 100dvh - 244px, Groundbreak 100dvh - 190px; phones anchor on the title bar and the frame is 100dvh - 300px so the footer clears the tab bar | this PR
- [x] SITE-launch-progress | S | game launch cover progress is three real steps (request, route, ready) on a segmented track with a live percent, a scan while the route loads, pointer light, and the save line read from this device | this PR
- [x] SITE-page-strip | S | the accent strip on the page-switch panels hides while they close and the seam holds, and returns as they open | this PR
- [x] SITE-window-chrome | S | game window chrome per game: back link in the title bar, themed title bar and footer (brass, Starwright, Groundbreak), icon-only Export and Import save with tooltips, status light, restyled bottom-right hint | this PR
- [x] SITE-brasswork-top-row | S | Brasswork top bar resource tiles stay on one row from 760 px to wide desktop (no nowrap-wrap of the parts list; narrow desktops zoom the strip) | this PR

## Next
(open, not waiting on Nate)
- [ ] SITE-games-sound-idle | S | suspend the Starwright and shared site sound contexts when a game is left, so nothing idles after leaving | same audit
- [ ] SITE-games-leave-key | S | optional: a documented key (for example Esc twice) to leave a game; today Esc only closes menus | same audit | taste, low priority
- [ ] SHELL-saves-one-path | M | point the in-game Export and Import rows (Starwright menu in `components/starwright/panels.tsx`, Groundbreak menu) at `lib/games/save-slot.ts` so there is one save path; each game's owner does its own file | window shell
- [ ] SHELL-phone-touch | S | on a real phone check the windowed panel: page scroll over the game by touch, Brasswork's touch bar and Starwright's hold gestures, and that the footer clears the site tab bar | untested: no real phone
- [ ] SHELL-webkit | S | run `scripts/ci/checks/run.mjs window` in WebKit; check `contain: layout` on the games' fixed roots and iPhone Safari (no full screen there) | untested
- [x] SITE-keys-tap | S | the "?keyboard shortcuts" button is 34px tall on phones; lift it to 44px on touch screens (`components/cm/keys.css`, Shell owner) | phone pass 2026-11-16 | claude/site-polish-taps-contrast
- [x] SITE-timeline-markers-tap | S | timeline milestone markers are 32px on phones and sit close together; a larger hit area on each card header would be better than bigger markers | phone pass 2026-11-16 | closed 2026-11-17: Nate chose to leave the journey markers; the milestone cards already measure 79 to 105px
- [ ] SITE-speed-game-css | M | Brasswork (about 48 KB gz CSS, 16 sheets) and Node Farm (about 50 KB gz) ship every rule; split by route and keep first-paint rules. Measure with real rule coverage first (the CDP numbers in `/mnt/project-files/portfolio/speed-2026-11-16/cov.mjs` read 0% unused, which is wrong) | docs/games/brasswork
- [ ] SITE-speed-nodefarm-js | M | Node Farm JS is about 450 KB gz; splitting it does not move the first board paint (`portfolio/node-farm-perf/load/REPORT.md`). The engine tables in `lib/nodefarm/engine.ts` are the real lever | docs/node-farm.md
- [ ] SITE-speed-home-cards | S | homepage Play cards load 337, 196 and 95 KB 1200w webp on phones when scrolled; a 960w phone tier would save about 100 KB. The current webp is already optimal, so it is lossy-only; needs a look check | components/home/games-showcase.tsx
- [ ] SITE-speed-guesser-js | M | flag and outline guessers each ship about 400 KB gz JS; find how much is shared site code and how much is the game | components/games/
- [ ] SITE-speed-brasswork-three | L | Brasswork's 3D renderer (about 88 KB gz) loads on first paint because the island is the first screen; only worth a change if the island gets a loading state | components/brasswork/brasswork-host.tsx
- [ ] SITE-stuck-timeline-tab | S | `scripts/ci/motion-stuck.mjs` fails 3 runs in 4 on the baseline build too: after tabbing on /timeline at 390, the phase buttons ("01 / September 2026 — Summer 2027") and "Hide" stay scrambled past 3 s. It is a blocking check, so it can fail a PR at random | docs/ci.md

## Needs Nate
(waiting on a decision, Nate's content or his own device; `ASK` prefix)
- [ ] ASK SITE-timeline-mobile | M | compact mobile mode for Timeline (11,900 px at 390) and Studies (9,400 px); target Timeline under 7,000 px; Nate has a decision card open (collapse live phase, or short cards with tap for detail); the live phase already starts open and holds about 4,400 px | audit 6
- [ ] ASK SITE-sfvos-shots | S | sfvOS screenshots and facts for its detail page; do not invent copy
- [ ] ASK SITE-gate-seo | S | keep fully private (disallow all in `robots.ts`, drop sitemap) or open OG images, favicon and home metadata only | audit 10
- [ ] ASK SITE-empty-pages | S | how Renovations and Blog read while empty (zeros and "Nothing here yet"; "Renovations —" in home stats); the pages themselves stay | audit 3
- [ ] ASK SITE-artwork | M | Artwork pages need Nate's pieces
- [ ] ASK SITE-writing | M | Philosophy and Politics posts for the Blog wait on Nate
- [ ] ASK SITE-device-checks | S | Nate's own checks: the three games on the live site, Node Farm on phone, sound and Safari
- [ ] ASK SITE-env-cleanup | S | Nate deletes GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel and drops the account tables in Supabase
- [ ] ASK SITE-branch-delete | S | threads cannot delete branches (403); Nate runs `branch-cleanup-delete.sh` from the audit folder, merged ones only | audit 9
- [ ] ASK SITE-stale-prs | S | decide PRs #399 and #400 (merge or close) and the Brasswork drafts; owners decide their own | audit 9
- [ ] ASK SITE-games-chrome | S | the games disagree on site chrome (Node Farm keeps header, dock and footer; the other three hide them); pick one rule, or leave | audit site-integration-audit-2026-11-15
- [ ] ASK SHELL-node-farm-window | M | move Node Farm from its framed page into the windowed panel too, or keep it framed (current) | Nate's taste; the Node Farm thread owns the page
- [x] ASK SITE-timeline-markers-layout | M | journey markers on phones are 32px and their centres sit 0, 18 and 29 px apart (two share a spot), so a 44px tap area would overlap the next marker and a CSS-only fix would open the wrong milestone. Milestone cards already have 79 to 105px headers. Options: (1) on phones, list the milestones as 44px rows and drop the track (recommended); (2) keep the track and let a tap on overlapping markers open a picker; (3) leave it | claude/site-polish-taps-contrast | decided 2026-11-17: leave markers as they are
- [x] ASK SITE-contrast-dim | S | `--cm-dim` (#75858e) is 3.6 to 3.9:1 on the dithered page for 5 labels: footer "keyboard shortcuts" and "?", the /history notes, the home "—" and the games "/" separators. Lifting the token by the minimum that clears them (+5.5 L, #75858e to #88979e) changes 33 uses in 14 files, games included, so it waits for Nate. Options: (1) move those 5 labels to `--cm-mute`, which clears 4.5 on every dithered label by median (lowest 4.65); no new colour (recommended); (2) lift the token to #88979e; (3) leave it | claude/site-polish-taps-contrast | decided 2026-11-17: lift the token site-wide (done)
- [ ] ASK SITE-contrast-paper | S | paper-theme `--cm-dim` (#8a8f94 on #f2f3f1, about 3:1 by arithmetic) appears on none of the eight routes, so it is unmeasured; the "Hide" label on a light plate reads 3.6:1 at 390 on /timeline (dark-scope paper-mute on a light plate) | claude/site-polish-taps-contrast

## Ideas
(offered to Nate, not picked)
- [ ] ASK SITE-resume | M | resume page
- [ ] ASK SITE-running | M | running page
- [ ] ASK SITE-case-studies | M | case studies
- [ ] ASK SITE-home-desktop | L | homepage as a desktop
- [ ] ASK SITE-currency | L | site-wide currency

## Code health
Slot for findings from the thread "Audit website code for simplification". That thread appends one line per finding here, with prefix `SITE-dead-`. Known leads from the site audit (audit 11, sequence after the Brasswork work): both `components/automation` and `components/brasswork` exist; `PLACEHOLDER_CATALOG`; `components/automation/mock.ts`; `/automation-preview` and `/dev/*` routes may be test or preview only.
- [ ] SITE-dead-nodefarm | M | Node Farm: about 80 unused exports in lib/nodefarm and components/nodefarm (`npx -y knip@5`); grep before deleting, since tests and scripts import some by path | Node Farm owner
- [ ] SITE-dead-brasswork | M | Brasswork: unused exports in lib/automation (models, input, render, sim) and components/automation/{mock,reward-moment,settings-window}.tsx; PLACEHOLDER_* names in lib/automation/sim/data.ts are used only by tests | Brasswork owner
- [ ] SITE-dead-starwright | S | Starwright: unused exports in lib/starwright/{engine,session,art,ui-art,settings,data}.ts and components/starwright/{paged,panels,sw-ui}.tsx | Starwright owner
- [ ] SITE-dead-groundbreak | S | Groundbreak: unused exports in lib/groundbreak and components/groundbreak-art; site-life and site-scene export the same component twice (`default` and a named alias) | Groundbreak owner
- [ ] SITE-dead-shell | S | Shell: NateMark (components/cm/mark.tsx) and useTyped (components/cm/typed.tsx) have no importers | shell owner
- [ ] SITE-dead-creations | S | GameModeSection in components/creations-sections.tsx has no importers | Creations owner
- [ ] SITE-dead-games-lib | S | Guessers and shared games lib: unused exports in lib/outline-game.ts and lib/games (save-slot checkSaveData), lib/game-launch (LAST_GAME_KEY, GAME_SAVES) | guessers and shell owners
- [ ] SITE-dead-types | S | Unused exported types in lib/{about,studies,creations,upcoming,blog,github,content,identity}*.ts and lib/og/card.tsx. Types only; unexport when the file's owner next edits it
- [x] ASK SITE-dead-orphan-scripts | S | Scripts nothing references: scripts/brasswork/preview-models.py, scripts/automation/tab-motion-check.mjs, scripts/nodefarm/{console-browser-check,guide-follow,tree-browser,web-basics-browser}.mjs, scripts/starwright/ui-art/landscape-shots.mjs. They are hand-run tools, so Nate decides which to delete | deleted: Nate chose delete all seven, 2026-11-18 | this PR
- [x] ASK SITE-dead-browser-test | M | tests/automation/browser fails on integration (touch-bar imports icons/ui, which the runner never copies). Nate chose fix, 2026-11-18: the runner now also serves tips.ts, and the stale phone checks follow the one-finger orbit design and pick an empty cell. 29 of 29 pass headless | this PR
- [ ] SITE-dead-deps | S | scripts use playwright, pngjs and pixelmatch without declaring them in the root package.json (scripts/ci has its own). Declare them or document the install
- [x] SITE-dead-knip | S | `knip.json` at the root: run `npx -y knip@5` for unused files, exports and deps. Removed the unused `getProjectAccentColor` and unexported unused gate and sound symbols. knip misses dynamic imports, so grep before deleting | this PR
- [ ] SITE-code-clamp | S | `clamp` or `clamp01` is copied into about 13 files (both idle engines, the Brasswork audio and math helpers, the sound and motion engines, Node Farm tree and guide, Starwright art, the homepage band engine). One shared helper, moved file by file as each owner next edits it. Done when no copy is left outside the owner's own file | owners of each file
- [ ] SITE-code-formatdate | S | `formatDate` is written four times: app/blog/[slug]/page.tsx, components/blog-section.tsx, components/commit-history.tsx, components/home/recent-posts.tsx. One helper in lib/ | pages owner
- [ ] SITE-code-save-download | S | Brasswork (components/brasswork/settings-extras.tsx) and Node Farm (components/nodefarm/node-farm.tsx) each build their own Blob download. Use the download helper in lib/games/save.ts. Node Farm's backup ring stays | Brasswork and Node Farm owners
- [ ] SITE-code-idle-core | M | Starwright and Groundbreak engines copy the same save parse, load, serialize, offline catch-up, buy and number-format code. A shared lib/idle-core would remove about 250 lines. Do it between backlog items for both games; the engine tests cover it | Starwright and Groundbreak owners
- [ ] ASK SITE-code-audio-reverb | S | lib/sound/engine.ts and lib/automation/audio/engine.ts build the same noise reverb and the same webkit fallback. Merging them changes how sound plays, so it needs a listening check on a phone first | shell owner and Brasswork owner

## Done (newest appended at the end)
- [x] SITE-motion-stuck-test | S | test that jumps to hash anchors, fast-scrolls and tabs through each route, and fails if any `data-rx` text is unresolved after 3 s; reduced motion shows plain text at once | audit 7 | scripts/ci/motion-stuck.mjs, runs in the blocking PR check; passed locally on the current site
- [x] SITE-a11y-sweep | S | scanned 12 routes at 390 on a production build: 0 images without alt, 0 unnamed buttons or links, 0 visible text under 11px (the audit's 7 to 9 per page, the one missing alt and the Node Farm button are already fixed) | headless Chromium only
- [x] SITE-css-per-route | M | load page CSS per route instead of everything through `globals.css`; record before and after bytes; `games.css` still carries homepage rules | audit 4 | WON'T DO: measured 2026-11-15, at most 21 KB source (about 4 KB gzipped) is page-specific and the shared file is cached once; report in /mnt/project-files/portfolio/css-audit-2026-11-15/css-audit.md
- [x] SITE-nodefarm-weight | M | partly done: 67 selectors that match nothing in any Node Farm state removed (486 to 480 KB, visually unchanged). The rest is shared, see SITE-nodefarm-css-split | css audit | #616
- [x] SITE-footer-mobile | S | footer at 390 is 1,259 px, down from 1,638 (directories two across, contact tiles three across) | screenshots in /mnt/project-files/portfolio/site-mobile/
- [x] SITE-timeline-cards-phone | S | Nate chose short cards, tap for detail (2026-11-15): milestones show title and date on phones, the description opens on tap; phases block 7,429 to 4,946 px at 390 | screenshots in /mnt/project-files/portfolio/site-mobile/
- [x] SITE-short-screen | S | under 700 px tall the windowed panel is the scroll anchor, so the game is up under the bar and the heading stays below it; footer clears the dock down to 657 px tall | #665 (coordinator decision, 2026-11-16)
- [x] SITE-phone-heading | S | decided by the coordinator on 2026-11-16: phones keep the panel as the anchor, so the Play heading can sit under the bar there | decided
- [x] SITE-hub-layout | S | Nate picked Poster on 2026-11-15 (decision card); rows and index layouts removed | #610 follow-up
- [x] SITE-motion-toggle | S | the motion setting now applies live both ways: off tears the engine down, on rebuilds it with no refresh, and on-screen content settles without replaying; the page curtain, typed lines and counters follow too | this PR
- [x] SITE-game-thumbs | M | real screenshot per game on the hub cards (captured from the built game, 16:10); the Creations featured grid still uses its own cards | done in the Games hub redesign | #610
- [x] SITE-nexus-iframe | S | remove the "Allow attribute will take precedence over allowfullscreen" log; load the embed on click behind a poster | audit 2 | the log is gone (frame uses `allow` only, `components/creations/deferred-frame.tsx`); loading on click behind a poster is not done and not needed while the frame loads after page load
- [x] SITE-bento-cards | M | finish the card overhaul if any remains (cards pinned footers, one title size landed in e016de91) | check state first | checked 2026-11-15: one dark treatment, pinned footers, one title size and grids that fill the row are live on the games hub; only the generic glyph previews remain (SITE-game-thumbs)
- [x] SITE-check-feature-docs | S | verify every line of `docs/site/FEATURES.md` against the code and fix mismatches | fixed fonts, dev routes, dock labels, share images; page behaviour lines checked by file only, not in a browser
- [x] SITE-games-exit | S | Brasswork top bar gets a Games link; every game's back link lands on its own section of the Games page | this PR
- [x] SITE-claude-md | S | root `CLAUDE.md` and `AGENTS.md` were referenced everywhere but missing; added short guides
- [x] SITE-console-help | S | console help entries stack and wrap at `|` | e03b1748
- [x] SITE-preload-warnings | S | no unused-preload warnings, Nexus page loads in 0.3 s | #483
- [x] SITE-home-games | S | homepage "Play" section: one card per playable game with a real capture, linking straight in; layout chosen from a decision card (three cards in a row, built as recommended) | this PR
- [x] SITE-pages-audit-2026-11-16 | S | non-game pages audited at 1440 and 390 (build, gate, search, console, transitions, stuck text, overlaps, LCP); no code change needed; report and before shots in /mnt/project-files/portfolio/site-audit-2026-11-16/REPORT.md | this PR
- [x] SITE-game-launch | S | themed cover into and out of each game, "Continue your save" line on each hub card, hub remembers the last game played | this PR
- [x] GUESS-merge-modes | size M | Daily and Unlimited merged into one page per guesser; Unlimited unlocks after a finished daily; old daily routes redirect | #634
- [x] SITE-phone-pass-2026-11-16 | S | non-game pages walked at 1440, 390 and 375 (14 routes, before and after PNGs in /mnt/project-files/site-pages-phone-2026-11-16/): no sideways scroll, no console errors; About profile footer stops wrapping "2027" on phones; chips and "more" links already have a 44px touch area (`app/camino/site.css`) | this PR
- [x] SHELL-play-under-bar | S | desktop windowed games: the Play heading and panel start below the site bar, and the panel and footer clear the site dock; Brasswork's left dock compacts under 1000 px tall | #654
- [x] SITE-short-screen-dock | S | footer clears the site dock down to 657 px tall (panel floor 260 px, height 100dvh minus 400 px), and Brasswork's left dock scrolls inside a short panel instead of clipping | #659
- [x] SITE-home-band-art | M | animated sprite art for each game across the whole homepage Play band, lazy and paused off screen | this PR
- [x] SITE-motion-card-art | S | pixel art on toned cards lifts and brightens on pointer hover; colour only under reduced motion; type pass: card text and studies course body on the 13.5px ui token (were 14px), About verbs on the 18px lead token (were 19px); the rest of the home and page motion already existed and was checked, not changed. Left: a 17px timeline date line and 12px stat numbers | this PR
- [x] SITE-short-anchor | S | desktop under 700 px tall anchors on the panel (the game matters more than the heading there) | #665
- [x] GUESS-reveal-polish | M | animated miss and win reveals, streak readout, Unlimited unlock moment, flag round double shake removed, reduced motion respected | this PR
- [x] SITE-motion-scale | M | one motion scale (easing, durations, lift and press travel) and one reduced-motion rule; buttons, chips, cards, home game cards and page shutters use it | this PR
- [x] SITE-dead-knip | S | `knip.json` at the root: run `npx -y knip@5` for unused files, exports and deps. Removed the unused `getProjectAccentColor` and unexported unused gate and sound symbols. knip misses dynamic imports, so grep before deleting | this PR
- [x] GUESS-share-result | S | Share result button on the Outline round-1 result and the Flag round result: plain text (result, streak over 1, URL), copies or opens the share sheet on touch, Copied and Copy failed states | this PR
- [x] SITE-review-play-copy | S | home Play blurb said "Each one opens full screen"; on desktop the windowed games open in their own window, so the copy now says that | claude/project-thread-mokb5p
- [x] SITE-review-shot-numbers | S | gallery numbers on Creations detail pages (Nexus, Deepstack) were 10px, under the 11px floor; now 11px | claude/project-thread-mokb5p
- [ ] ASK SITE-review-km-label | S | the distance button in Outline and Flag Guesser reads "km" or "mi" with no visible hint of what it does; the aria-label says it, sighted players get no clue. Add a visible hint or leave | 2026-11-18 site review
- [x] SITE-code-health-1118 | S | repo sweep 2026-11-18: typecheck clean; engine tests 485 pass, 0 fail, 1 todo; security pass on the gate, /api routes, external links and inline scripts found nothing to fix. Findings logged in Code health above | this PR
