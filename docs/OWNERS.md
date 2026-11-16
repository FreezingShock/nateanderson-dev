# Ownership

One owner per path area at a time, so threads do not edit the same files. Ownership is recorded here, one line per area, and lasts until the thread finishes or hands off. To take or release an area, edit only your own line.

Format: `- area | paths | owner (thread title or "free") | since YYYY-MM-DD | docs`

## Site
- Shell, nav, console, search | components/cm, lib/nav.ts, lib/search, lib/motion, app/camino/{ctos,nav-naos,motion,entrances,transition}.css | Fix the animations toggle without refresh | 2026-11-16 | docs/site
- Pages (home, about, studies, timeline, history, blog) | app/{page,about,studies,timeline,history,blog}, components/home, lib/*-data.ts | Polish site pages on phones | 2026-11-16 | docs/site
- Homepage games showcase | components/home/games-showcase.tsx, public/home/games, the Play section in app/page.tsx and components/home/home.css (the `gs-` rules) | Feature games on the homepage | 2026-11-15 | docs/site
- Creations and games hub | app/creations (not games/*), components/creations, components/games/naos.tsx, lib/creations-data.ts, public/games/shots | Games page redesign | 2026-11-15 | docs/site
- Game launch and exit flow | app/creations/games/layout.tsx, components/game-launch, lib/game-launch, app/camino/game-launch.css | Smooth the game launch and exit flow | 2026-11-16 | docs/site
- Gate, SEO, CI, deploy | proxy.ts, lib/gate, lib/seo.ts, .github, scripts/ci, vercel.json | free | | docs/deploys.md, docs/ci.md

## Games
- Brasswork | components/{brasswork,brasswork-ui,brasswork-art,automation}, lib/{brasswork,automation}, tests/automation, scripts/{brasswork,automation} | Ship the Brasswork backlog; phone layout and camera pad | 2026-11-15 | docs/games/brasswork
- Brasswork sound pass | lib/automation/audio, components/brasswork/audio-rows.tsx, scripts/automation/sound-check.mjs | Add sound to Brasswork | 2026-11-15 | docs/games/brasswork
- Brasswork recipe picker | components/automation/inspector.{tsx,css}, lib/automation/sim/recipe-tag.ts, tests/automation/recipe-picker.test.mjs, scripts/automation/recipe-picker-shots.mjs | Rework Brasswork recipe selection | 2026-11-15 | docs/games/brasswork
- Starwright | components/starwright, lib/starwright, app/camino/starwright*.css, tests/starwright, scripts/starwright | Ship the Starwright backlog (all Starwright files) | 2026-11-15 | docs/games/starwright
- Groundbreak | components/{groundbreak,groundbreak-art}, lib/{groundbreak,groundbreak-fonts}, app/camino/groundbreak.css, tests/groundbreak, scripts/{groundbreak,groundbreak-art} | Ship the Groundbreak backlog (all Groundbreak files) | 2026-11-15 | docs/games/groundbreak
- Node Farm | components/nodefarm, lib/nodefarm, app/camino/nodefarm, tests/nodefarm, scripts/nodefarm | Build the Node Farm page | 2026-11-16 | docs/node-farm.md, docs/site
- Outline and Flag Guesser | components/games/*.tsx, lib/outline-game.ts, lib/data, scripts/games/guessers-check.mjs | Merge daily and unlimited guesser modes | 2026-11-16 | docs/site
- Shared game shell and windowed panel | components/games/shell, lib/games, app/camino/game-shell.css, app/creations/games/{brasswork,starwright,groundbreak}/layout.tsx and page.tsx (metadata only), route-chrome removed from both games | Build the shared game shell and windowed panel | 2026-11-16 | docs/site

Inside a game, finer ownership (art, menus, sim, QOL) is recorded in that game's `docs/games/<game>/BACKLOG.md` header, if it has one.
- Brasswork menu motion | components/brasswork-ui/motion.css, window.css and window.tsx motion rules, automation/phone-menu-art.css, brasswork/codex.tsx, hub-menu motion, press timings in the brass kit and skin files | Animate Brasswork menus | 2026-11-15 | docs/games/brasswork
- Brasswork desktop windows and Settings | components/automation/{settings-window.tsx,settings-window.css,factory-sections.tsx}, components/brasswork/settings-extras.tsx, desktop rules in components/automation/desktop-stage.css and empty-states.css, scripts/automation/fit-check.mjs | Fit and unify Brasswork desktop windows | 2026-11-16 | docs/games/brasswork
