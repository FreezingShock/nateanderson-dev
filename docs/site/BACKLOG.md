# Site backlog (non-game)

Format and rules: `docs/WORKFLOW.md`. Append new items at the end of a section; mark done by `[x]` and `| #PR` on the same line. `ASK` means it needs Nate first. Seeded 2026-11-15 from the site audit (`/mnt/project-files/portfolio/site-audit-2026-11-14/site-audit.md`, numbers in brackets) and project memory. Already fixed since the audit: console help wrapping and 11px dock labels (e03b1748), preload warnings and Nexus load time (#483).

## Now
- [x] SITE-motion-stuck-test | S | test that jumps to hash anchors, fast-scrolls and tabs through each route, and fails if any `data-rx` text is unresolved after 3 s; reduced motion shows plain text at once | audit 7 | scripts/ci/motion-stuck.mjs, runs in the blocking PR check; passed locally on the current site
- [x] SITE-a11y-sweep | S | scanned 12 routes at 390 on a production build: 0 images without alt, 0 unnamed buttons or links, 0 visible text under 11px (the audit's 7 to 9 per page, the one missing alt and the Node Farm button are already fixed) | headless Chromium only
- [ ] SITE-contrast | S | measure contrast of dim mono labels against the dithered backgrounds (needs a sampled-pixel check, not a CSS colour check) and lift any under 4.5:1
- [ ] SITE-css-per-route | M | load page CSS per route instead of everything through `globals.css`; record before and after bytes; `games.css` still carries homepage rules | audit 4
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

## Next
- [ ] SITE-game-thumbs | M | dithered screenshot per game on the hub and the Creations featured grid; Brasswork card still says OFFLINE and "In development" while playable; run after the card overhaul | audit 5 | light taste call on crop style
- [x] SITE-nexus-iframe | S | remove the "Allow attribute will take precedence over allowfullscreen" log; load the embed on click behind a poster | audit 2 | the log is gone (frame uses `allow` only, `components/creations/deferred-frame.tsx`); loading on click behind a poster is not done and not needed while the frame loads after page load
- [x] SITE-bento-cards | M | finish the card overhaul if any remains (cards pinned footers, one title size landed in e016de91) | check state first | checked 2026-11-15: one dark treatment, pinned footers, one title size and grids that fill the row are live on the games hub; only the generic glyph previews remain (SITE-game-thumbs)
- [x] SITE-check-feature-docs | S | verify every line of `docs/site/FEATURES.md` against the code and fix mismatches | fixed fonts, dev routes, dock labels, share images; page behaviour lines checked by file only, not in a browser
- [ ] ASK SITE-games-chrome | S | the games disagree on site chrome (Node Farm keeps header, dock and footer; the other three hide them); pick one rule, or leave | audit site-integration-audit-2026-11-15
- [ ] SITE-games-sound-idle | S | suspend the Starwright and shared site sound contexts when a game is left, so nothing idles after leaving | same audit
- [ ] SITE-games-leave-key | S | optional: a documented key (for example Esc twice) to leave a game; today Esc only closes menus | same audit | taste, low priority

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
