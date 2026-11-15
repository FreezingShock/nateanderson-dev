# Ownership

One owner per path area at a time, so threads do not edit the same files. Ownership is recorded here, one line per area, and lasts until the thread finishes or hands off. To take or release an area, edit only your own line.

Format: `- area | paths | owner (thread title or "free") | since YYYY-MM-DD | docs`

## Site
- Shell, nav, console, search | components/cm, lib/nav.ts, lib/search, lib/motion, app/camino/{ctos,nav-naos,motion,entrances,transition}.css | free | | docs/site
- Pages (home, about, studies, timeline, history, blog) | app/{page,about,studies,timeline,history,blog}, components/home, lib/*-data.ts | free | | docs/site
- Creations and games hub | app/creations (not games/*), components/creations, lib/creations-data.ts | free | | docs/site
- Gate, SEO, CI, deploy | proxy.ts, lib/gate, lib/seo.ts, .github, scripts/ci, vercel.json | free | | docs/deploys.md, docs/ci.md

## Games
- Brasswork | components/{brasswork,brasswork-ui,brasswork-art,automation}, lib/{brasswork,automation}, tests/automation, scripts/{brasswork,automation} | per `docs/games/brasswork/` | | docs/games/brasswork
- Starwright | components/starwright, lib/starwright, app/camino/starwright*.css, tests/starwright, scripts/starwright | per `docs/games/starwright/` | | docs/games/starwright
- Groundbreak | components/{groundbreak,groundbreak-art}, lib/{groundbreak,groundbreak-fonts}, app/camino/groundbreak.css, tests/groundbreak, scripts/{groundbreak,groundbreak-art} | per `docs/games/groundbreak/` | | docs/games/groundbreak
- Node Farm | components/nodefarm, lib/nodefarm, app/camino/nodefarm, tests/nodefarm, scripts/nodefarm | free | | docs/node-farm.md, docs/site
- Outline and Flag Guesser | components/games/*.tsx, lib/outline-game.ts, lib/data | free | | docs/site
- Shared game shell | components/games/shell, lib/games, app/camino/game-shell.css | free | | docs/site

Inside a game, finer ownership (art, menus, sim, QOL) is recorded in that game's `docs/games/<game>/BACKLOG.md` header, if it has one.
