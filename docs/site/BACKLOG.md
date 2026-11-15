# Site backlog (non-game)

Format and rules: `docs/WORKFLOW.md`. Append new items at the end of a section; mark done by `[x]` and `| #PR` on the same line. `ASK` means it needs Nate first. Seeded 2026-11-15 from the site audit (`/mnt/project-files/portfolio/site-audit-2026-11-14/site-audit.md`, numbers in brackets) and project memory. Already fixed since the audit: console help wrapping and 11px dock labels (e03b1748), preload warnings and Nexus load time (#483).

## Now
- [ ] SITE-motion-stuck-test | S | test that jumps to hash anchors, fast-scrolls and tabs through each route, and fails if any `data-rx` text is unresolved after 3 s; reduced motion shows plain text at once | audit 7
- [ ] SITE-a11y-sweep | S | alt on the one image missing it (home, Creations), name the unnamed Node Farm button, contrast on dim mono labels, before and after counts | audit 8
- [ ] SITE-css-per-route | M | load page CSS per route instead of everything through `globals.css`; record before and after bytes; `games.css` still carries homepage rules | audit 4
- [ ] SITE-footer-mobile | M | collapse footer directories on phones, compact mobile mode for Timeline (12,200 px at 390) and Studies (10,100 px); target Timeline under 7,000 px | audit 6
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
- [ ] SITE-nexus-iframe | S | remove the "Allow attribute will take precedence over allowfullscreen" log; load the embed on click behind a poster | audit 2
- [ ] SITE-bento-cards | M | finish the card overhaul if any remains (cards pinned footers, one title size landed in e016de91) | check state first
- [ ] SITE-check-feature-docs | S | verify every line of `docs/site/FEATURES.md` against the code and fix mismatches

## Ideas (offered to Nate, not picked)
- [ ] ASK SITE-resume | M | resume page
- [ ] ASK SITE-running | M | running page
- [ ] ASK SITE-case-studies | M | case studies
- [ ] ASK SITE-home-desktop | L | homepage as a desktop
- [ ] ASK SITE-currency | L | site-wide currency

## Code health
Slot for findings from the thread "Audit website code for simplification". That thread appends one line per finding here, with prefix `SITE-dead-`. Known leads from the site audit (audit 11, sequence after the Brasswork work): both `components/automation` and `components/brasswork` exist; `PLACEHOLDER_CATALOG`; `components/automation/mock.ts`; `/automation-preview` and `/dev/*` routes may be test or preview only.

## Done
- [x] SITE-console-help | S | console help entries stack and wrap at `|` | e03b1748
- [x] SITE-preload-warnings | S | no unused-preload warnings, Nexus page loads in 0.3 s | #483
