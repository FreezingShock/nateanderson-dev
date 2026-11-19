# Ownership

One owner per path area at a time, so threads do not edit the same files. Ownership is recorded here, one line per area, and lasts until the thread finishes or hands off. To take or release an area, edit only your own line.

Format: `- area | paths | owner (thread title or "free") | since YYYY-MM-DD | docs`

## Site
- Shell, nav, console, search | components/cm, lib/nav.ts, lib/search, lib/motion, app/camino/{ctos,nav-naos,motion,entrances,transition}.css | Fix the animations toggle without refresh | 2026-11-16 | docs/site
- Site motion scale (tokens, hover, press, cards, buttons, page shutters) | app/camino/camino.tokens.css (Motion), app/camino/camino.components.css (buttons, chips, cards), app/camino/transition.css (timings only), hover and press rules in app/camino/site.css, components/creations/creations.css, components/home/home.css `gs-card` | Build a site-wide motion system | 2026-11-16 | docs/site
- Pages (home, about, studies, timeline, history, blog) | app/{page,about,studies,timeline,history,blog}, components/home, lib/*-data.ts | Polish site pages on phones | 2026-11-16 | docs/site
- Homepage games showcase and band art | components/home/games-showcase.tsx, components/home/games-band*.ts(x), components/home/band-atlas.ts, public/home/games, public/home/band, scripts/home-band, the Play section in app/page.tsx and components/home/home.css (the `gs-` rules and `#play`) | Animate sprite art behind game cards | 2026-11-16 | docs/site
- Creations and games hub | app/creations (not games/*), components/creations, components/games/naos.tsx, lib/creations-data.ts, public/games/shots | Games page redesign | 2026-11-15 | docs/site
- Game launch and exit flow | app/creations/games/layout.tsx, components/game-launch, lib/game-launch, app/camino/game-launch.css | Smooth the game launch and exit flow | 2026-11-16 | docs/site
- Site motion on home and non-game pages (hover life for toned card art) | app/camino/site-motion.css | Animate homepage and site pages | 2026-11-16 | docs/site
- Route loading panel, route warm-up and game launch cover | app/system/system-naos.css (`.sys-load` only), components/cm/motion-root.tsx (warm-up effect only), components/game-launch/*, app/camino/game-launch.css, app/camino/transition.css (strip rules only), `.gs-frame` height and the title-bar anchor in app/camino/game-shell.css and components/games/shell/game-route-shell.tsx | Speed up game loads and page transitions | 2026-11-19 | docs/site
- Gate, SEO, CI, deploy | proxy.ts, lib/gate, lib/seo.ts, .github, scripts/ci, vercel.json | Unify game check scripts | 2026-11-16 | docs/deploys.md, docs/ci.md
- naOS status panel on the home hero (last-commit line, panel layout on phones) | components/home/last-commit.tsx, the `.hero-status` and `.hs-commit` rules in components/home/home.css, the `aside.hero-status` block in app/page.tsx | Show the last commit in naOS status | 2026-11-19 | docs/site

## Games
- Brasswork | components/{brasswork,brasswork-ui,brasswork-art,automation}, lib/{brasswork,automation}, tests/automation, scripts/{brasswork,automation} | Ship the Brasswork backlog; phone layout and camera pad | 2026-11-15 | docs/games/brasswork
- Brasswork sound pass | lib/automation/audio, components/brasswork/audio-rows.tsx, scripts/automation/sound-check.mjs | Add sound to Brasswork | 2026-11-15 | docs/games/brasswork
- Brasswork recipe picker | components/automation/inspector.{tsx,css}, lib/automation/sim/recipe-tag.ts, tests/automation/recipe-picker.test.mjs, scripts/automation/recipe-picker-shots.mjs | Rework Brasswork recipe selection | 2026-11-15 | docs/games/brasswork
- Starwright | components/starwright, lib/starwright, app/camino/starwright*.css, tests/starwright, scripts/starwright | Ship the Starwright backlog (all Starwright files) | 2026-11-15 | docs/games/starwright
- Groundbreak | components/{groundbreak,groundbreak-art}, lib/{groundbreak,groundbreak-fonts}, app/camino/groundbreak.css, tests/groundbreak, scripts/{groundbreak,groundbreak-art} | Ship the Groundbreak backlog (all Groundbreak files) | 2026-11-19 | docs/games/groundbreak
- Groundbreak Skyline and Firm windows | components/groundbreak/groundbreak.tsx `SkylineView` and the Firm window body only; app/camino/groundbreak.css skyline block (`.gb-sky`) and the phone firm block at its end | Redraw Groundbreak skyline window | 2026-11-16 | docs/games/groundbreak
- Node Farm | components/nodefarm, lib/nodefarm, app/camino/nodefarm, tests/nodefarm, scripts/nodefarm | Build the Node Farm page | 2026-11-16 | docs/node-farm.md, docs/site
- Outline and Flag Guesser | components/games/*.tsx, lib/outline-game.ts, lib/data, scripts/games/guessers-check.mjs | Polish guessers with animated reveals | 2026-11-16 | docs/site
- Shared game shell and windowed panel | components/games/shell, lib/games, app/camino/game-shell.css, app/creations/games/{brasswork,starwright,groundbreak}/layout.tsx and page.tsx (metadata only), route-chrome removed from both games | Build the shared game shell and windowed panel | 2026-11-16 | docs/site
- Save system (format, migrations, backups, corrupt copies, export and import) | lib/saves, lib/games/save.ts, lib/games/save-slot.ts, lib/games/guess-stats.ts, tests/saves, save functions and defs in lib/{groundbreak,starwright,automation/sim,nodefarm}/engine or save files, lib/nodefarm/save.ts | Unify game saves with migrations | 2026-11-16 | docs/saves.md
- Shared game kit | lib/game-kit, components/game-kit, app/camino/game-kit.css, tests/games/game-kit.test.mjs, docs/game-kit.md | Build a shared game kit | 2026-11-16 | docs/game-kit.md

- New-game template | scripts/games/new-game.mjs, scripts/games/new-game/, scripts/games/games-under-check.json, scripts/ci/checks (the template games' checks), docs/games/NEW-GAME.md | Make a fast new-game template | 2026-11-16 | docs/games/NEW-GAME.md
<!-- gen-anchor: owners -->
Inside a game, finer ownership (art, menus, sim, QOL) is recorded in that game's `docs/games/<game>/BACKLOG.md` header, if it has one.
- Brasswork menu motion | components/brasswork-ui/motion.css, window.css and window.tsx motion rules, automation/phone-menu-art.css, brasswork/codex.tsx, hub-menu motion, press timings in the brass kit and skin files | Animate Brasswork menus | 2026-11-15 | docs/games/brasswork
- Brasswork desktop windows and Settings | components/automation/{settings-window.tsx,settings-window.css,factory-sections.tsx}, components/brasswork/settings-extras.tsx, desktop rules in components/automation/desktop-stage.css and empty-states.css, scripts/automation/fit-check.mjs | Fit and unify Brasswork desktop windows | 2026-11-16 | docs/games/brasswork
- Brasswork ground tones and edge dither | lib/automation/render/{terrain,mesher,postfx,config}.ts | Calmer Brasswork ground (done 2026-11-16, released) | 2026-11-16 | docs/games/brasswork
- Brasswork research screen | components/automation/research-screen.{tsx,css}, scripts/automation/research-check.mjs | Make Brasswork research readable (released when its PR merges) | 2026-11-16 | docs/games/brasswork
- Brasswork review (palette sheet groups, Settings tab row on short windows) | components/automation/build-bar.tsx, components/automation/factory-sections.tsx (Section), components/automation/settings-window.css | Review and polish Brasswork | 2026-11-18 | docs/games/brasswork
- Starwright star canvas resolution | components/starwright/starwright.tsx (integer pixel scale effect only) | Sharpen game resolution on all screens | 2026-11-18 | docs/games/starwright
- Brasswork render resolution (device pixel ratio, pixel blocks, canvas CSS) | lib/automation/render/index.ts, app/camino/brasswork.css (`.bw-canvas` only) | Sharpen game resolution on all screens | 2026-11-18 | docs/games/brasswork
