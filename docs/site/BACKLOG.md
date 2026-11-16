# Site backlog (non-game)

Format and rules: `docs/WORKFLOW.md`. Append new items at the end of a section; mark done by `[x]` and `| #PR` on the same line. `ASK` means it needs Nate first. Seeded 2026-11-15 from the site audit (`/mnt/project-files/portfolio/site-audit-2026-11-14/site-audit.md`, numbers in brackets) and project memory. Already fixed since the audit: console help wrapping and 11px dock labels (e03b1748), preload warnings and Nexus load time (#483).

## Now
- [x] SITE-motion-stuck-test | S | test that jumps to hash anchors, fast-scrolls and tabs through each route, and fails if any `data-rx` text is unresolved after 3 s; reduced motion shows plain text at once | audit 7 | scripts/ci/motion-stuck.mjs, runs in the blocking PR check; passed locally on the current site
- [x] SITE-a11y-sweep | S | scanned 12 routes at 390 on a production build: 0 images without alt, 0 unnamed buttons or links, 0 visible text under 11px (the audit's 7 to 9 per page, the one missing alt and the Node Farm button are already fixed) | headless Chromium only
- [ ] SITE-contrast | S | measure contrast of dim mono labels against the dithered backgrounds (needs a sampled-pixel check, not a CSS colour check) and lift any under 4.5:1
- [x] SITE-css-per-route | M | load page CSS per route instead of everything through `globals.css`; record before and after bytes; `games.css` still carries homepage rules | audit 4 | WON'T DO: measured 2026-11-15, at most 21 KB source (about 4 KB gzipped) is page-specific and the shared file is cached once; report in /mnt/project-files/portfolio/css-audit-2026-11-15/css-audit.md
- [x] SITE-nodefarm-weight | M | partly done: 67 selectors that match nothing in any Node Farm state removed (486 to 480 KB, visually unchanged). The rest is shared, see SITE-nodefarm-css-split | css audit | #616
- [ ] SITE-nodefarm-css-split | L | split Node Farm CSS so panels load on first open: about 290 KB of rules use classes that several modules share, so each split needs a class-ownership pass first | docs/node-farm.md CSS notes
- [x] SITE-footer-mobile | S | footer at 390 is 1,259 px, down from 1,638 (directories two across, contact tiles three across) | screenshots in /mnt/project-files/portfolio/site-mobile/
- [ ] ASK SITE-timeline-mobile | M | compact mobile mode for Timeline (11,900 px at 390) and Studies (9,400 px); target Timeline under 7,000 px; Nate has a decision card open (collapse live phase, or short cards with tap for detail); the live phase already starts open and holds about 4,400 px | audit 6
- [x] SITE-timeline-cards-phone | S | Nate chose short cards, tap for detail (2026-11-15): milestones show title and date on phones, the description opens on tap; phases block 7,429 to 4,946 px at 390 | screenshots in /mnt/project-files/portfolio/site-mobile/
- [ ] SITE-timeline-overview-phone | S | Timeline is still about 9,400 px at 390; the overview section is 2,038 px and the live phase 2,938 px; trim the overview to reach the 7,000 px target | audit 6
- [ ] SITE-studies-mobile | M | Studies is 9,400 px at 390 (classes 2,398, reading 1,083, pathway 1,280); same short-card treatment
- [ ] SITE-creations-detail | M | hero image, short build story, stack and role block, screenshots on each detail page | audit 2 | needs Nate's facts, see below

## Needs Nate
- [ ] ASK SITE-sfvos-shots | S | sfvOS screenshots and facts for its detail page; do not invent copy
- [ ] ASK SITE-gate-seo | S | keep fully private (disallow all in `robots.ts`, drop sitemap) or open OG images, favicon and home metadata only | audit 10
- [ ] ASK SITE-empty-pages | S | how Renovations and Blog read while empty (zeros and "Nothing here yet"; "Renovations —" in home stats); the pages themselves stay | audit 3
- [ ] ASK SITE-artwork | M | Artwork pages need Nate's pieces
- [ ] ASK SITE-writing | M | Philosophy and Politics posts for the Blog wait on Nate
- [ ] ASK SITE-device-checks | S | Nate's own checks: the three games on the live site, Node Farm on phone, sound and Safari
- [ ] ASK SITE-env-cleanup | S | Nate deletes GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel and drops the account tables in Supabase
- [ ] ASK SITE-branch-delete | S | threads cannot delete branches (403); Nate runs `branch-cleanup-delete.sh` from the audit folder, merged ones only | audit 9
- [ ] ASK SITE-stale-prs | S | decide PRs #399 and #400 (merge or close) and the Brasswork drafts; owners decide their own | audit 9
- [ ] ASK SITE-short-screen | S | on screens under about 700 px tall the windowed panel sits at its 260 px floor and is small (1366 by 657 laptops); the footer now clears the dock everywhere | pick: keep the floor, or anchor those screens on the panel and let the heading sit under the bar
- [x] SITE-phone-heading | S | decided by the coordinator on 2026-11-16: phones keep the panel as the anchor, so the Play heading can sit under the bar there | decided

- [x] SITE-hub-layout | S | Nate picked Poster on 2026-11-15 (decision card); rows and index layouts removed | #610 follow-up
- [x] SITE-motion-toggle | S | the motion setting now applies live both ways: off tears the engine down, on rebuilds it with no refresh, and on-screen content settles without replaying; the page curtain, typed lines and counters follow too | this PR

## Next
- [x] SITE-game-thumbs | M | real screenshot per game on the hub cards (captured from the built game, 16:10); the Creations featured grid still uses its own cards | done in the Games hub redesign | #610
- [x] SITE-nexus-iframe | S | remove the "Allow attribute will take precedence over allowfullscreen" log; load the embed on click behind a poster | audit 2 | the log is gone (frame uses `allow` only, `components/creations/deferred-frame.tsx`); loading on click behind a poster is not done and not needed while the frame loads after page load
- [x] SITE-bento-cards | M | finish the card overhaul if any remains (cards pinned footers, one title size landed in e016de91) | check state first | checked 2026-11-15: one dark treatment, pinned footers, one title size and grids that fill the row are live on the games hub; only the generic glyph previews remain (SITE-game-thumbs)
- [x] SITE-check-feature-docs | S | verify every line of `docs/site/FEATURES.md` against the code and fix mismatches | fixed fonts, dev routes, dock labels, share images; page behaviour lines checked by file only, not in a browser
- [ ] ASK SITE-games-chrome | S | the games disagree on site chrome (Node Farm keeps header, dock and footer; the other three hide them); pick one rule, or leave | audit site-integration-audit-2026-11-15
- [ ] SITE-games-sound-idle | S | suspend the Starwright and shared site sound contexts when a game is left, so nothing idles after leaving | same audit
- [ ] SITE-games-leave-key | S | optional: a documented key (for example Esc twice) to leave a game; today Esc only closes menus | same audit | taste, low priority
- [ ] SHELL-saves-one-path | M | point the in-game Export and Import rows (Starwright menu in `components/starwright/panels.tsx`, Groundbreak menu) at `lib/games/save-slot.ts` so there is one save path; each game's owner does its own file | window shell
- [ ] SHELL-phone-touch | S | on a real phone check the windowed panel: page scroll over the game by touch, Brasswork's touch bar and Starwright's hold gestures, and that the footer clears the site tab bar | untested: no real phone
- [ ] SHELL-webkit | S | run `scripts/games/window-check.mjs` in WebKit; check `contain: layout` on the games' fixed roots and iPhone Safari (no full screen there) | untested
- [ ] ASK SHELL-node-farm-window | M | move Node Farm from its framed page into the windowed panel too, or keep it framed (current) | Nate's taste; the Node Farm thread owns the page

- [ ] SITE-keys-tap | S | the "?keyboard shortcuts" button is 34px tall on phones; lift it to 44px on touch screens (`components/cm/keys.css`, Shell owner) | phone pass 2026-11-16
- [ ] SITE-timeline-markers-tap | S | timeline milestone markers are 32px on phones and sit close together; a larger hit area on each card header would be better than bigger markers | phone pass 2026-11-16

## Ideas (offered to Nate, not picked)
- [ ] ASK SITE-resume | M | resume page
- [ ] ASK SITE-running | M | running page
- [ ] ASK SITE-case-studies | M | case studies
- [ ] ASK SITE-home-desktop | L | homepage as a desktop
- [ ] ASK SITE-currency | L | site-wide currency

## Code health
Slot for findings from the thread "Audit website code for simplification". That thread appends one line per finding here, with prefix `SITE-dead-`. Known leads from the site audit (audit 11, sequence after the Brasswork work): both `components/automation` and `components/brasswork` exist; `PLACEHOLDER_CATALOG`; `components/automation/mock.ts`; `/automation-preview` and `/dev/*` routes may be test or preview only.

## Done
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
- [x] SITE-short-screen-dock | S | footer clears the site dock down to 657 px tall (panel floor 260 px, height 100dvh minus 400 px), and Brasswork's left dock scrolls inside a short panel instead of clipping | #PR
