<div align="center">

<img src="public/icon-512x512.png" alt="Nate's Portfolio logo" width="96" height="96" />

# Nate's Portfolio

### Games, renders, and systems — built while studying toward environmental engineering.

<br />

[![Live](https://img.shields.io/badge/LIVE-nateanderson.dev-33dce8?style=for-the-badge&labelColor=040506)](https://nateanderson.dev)

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-040506?style=flat-square&logo=react&logoColor=33dce8)
![TypeScript](https://img.shields.io/badge/TypeScript-040506?style=flat-square&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-040506?style=flat-square&logo=tailwindcss&logoColor=33dce8)

<br />

**[Visit the site](https://nateanderson.dev)** &nbsp;·&nbsp; **[Play the games](https://nateanderson.dev/creations/games)** &nbsp;·&nbsp; **[About me](https://nateanderson.dev/about)**

</div>

<br />

---

## What is this?

My personal corner of the internet: a portfolio, a playground, and a running log of everything I make. The site uses **Camino**, a dark, instrument-panel design system: one cyan accent, hairline borders, mono labels, and highlight-bar headings. It has a dark default and a light **paper** theme, and stays fast, responsive, and readable.

> [!NOTE]
> The site is a work in progress. Some pages are placeholders while I build them out one at a time.

---

## Explore

| Section | What you'll find |
| :-- | :-- |
| **[Home](https://nateanderson.dev)** | Intro, selected work, live site stats, timeline preview |
| **[About](https://nateanderson.dev/about)** | Running stats, race breakdown, philosophy, education timeline, skills |
| **[Creations](https://nateanderson.dev/creations)** | Hub for games, projects, renovations, and artwork |
| **[Games](https://nateanderson.dev/creations/games)** | Browser games: daily puzzles and unlimited practice |
| **[Studies](https://nateanderson.dev/studies)** | Coursework explorer, education pathway, reading queue |
| **[Timeline](https://nateanderson.dev/timeline)** | Milestones, live countdowns and the journey to 2031 |
| **[History](https://nateanderson.dev/history)** | Commit history pulled live from GitHub |
| **[Blog](https://nateanderson.dev/blog)** | Writing and updates |

---

## Games

Playable right in the browser, with a **daily** mode (same puzzle for everyone) and an **unlimited** mode for practice.

| Game | Description |
| :-- | :-- |
| **Outline Guesser** | Worldle-style: identify a country from its outline. Daily schedule, filters, a neighbours round, a flag round, and an end-of-run summary. |
| **Flag Guesser** | Name the country from its flag. Tile-flip reveal, country dice, and full keyboard controls. |

More daily and repeatable games are planned.

---

## Design language

- **One accent.** Cyan (`--cm-cyan`) on a near-black ground, with a light `paper` theme.
- **Hairlines, not shadows.** Panels, tags and chips use 1px rules and 0 to 2px radii.
- **Mono labels, Arimo display.** IBM Plex Mono for labels and data, Arimo for headings.
- **Highlight-bar headings.** First bar black, the rest cyan.
- **Quiet motion.** A film and grain layer, one sweep on load, and short eased transitions. All of it respects `prefers-reduced-motion`.

Tokens live in `app/camino/camino.tokens.css`, shared components in `app/camino/camino.components.css`, and site layout in `app/camino/site.css`.

---

## Tech stack

| Layer | Tools |
| :-- | :-- |
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling** | Camino design system, Tailwind CSS v4, `next-themes` |
| **Maps & data** | `d3-geo`, `topojson-client` (country outlines) |
| **Backend** | Supabase |
| **Hosting** | Vercel, auto-deployed from `main` |

---

## Run it locally

```bash
git clone https://github.com/FreezingShock/nateanderson-dev.git
cd nateanderson-dev
npm install
```

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
GITHUB_TOKEN=your-github-token   # optional, used for the History page
```

Start the dev server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

| Command | Does |
| :-- | :-- |
| `npm run dev` | Dev server with Turbopack |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the code |
| `npm run format` | Format with Prettier |

---

## Project structure

```text
├── app/            # Routes (App Router): about, creations, studies, timeline, history, blog
├── components/     # Site UI: bar, launcher, footer, games, explorers
│   └── cm/         # Camino shell: bar, launcher, film, page header
├── lib/            # Data and helpers: creations, timeline, studies, GitHub, Supabase
├── actions/        # Server actions
├── scripts/        # Build scripts for game data (outlines, neighbours, flags, daily schedule)
└── public/         # Icons, flags, static assets
```

---

<div align="center">

**Built by [Nate](https://github.com/FreezingShock)** &nbsp;·&nbsp; [nateanderson.dev](https://nateanderson.dev)

<sub>Camino · one accent, no rainbow</sub>

</div>
