---
name: portfolio-ship-loop
description: "Verify-and-ship sequence for nateanderson-dev (Next.js/Tailwind v4/Supabase/Vercel). Use for every code change to this repo."
---

# Portfolio ship loop

Branches: `main` is production (Vercel auto-deploys). `integration` is where all work lands first.
Each task branches off `integration` (`feat/...`, `fix/...`) and opens a PR into `integration`.
Only merge `integration` into `main` when Nate approves.

1. **Edit the code.** Match surrounding style (Prettier, 4 spaces).
2. **`npm install` if needed, then `npm run build`.** This is the type and lint gate. A clean build
   means a "bug" seen later is probably stale tooling.
3. **Fresh dev server.** Stop any old `next dev` (port 3000), then run `npm run dev`.
   - macOS/Linux: `pkill -f "next dev"`
   - Windows: `taskkill /F /IM node.exe`
   Wait for "Ready" in the output.
4. **Fresh browser tab.** Never trust a tab opened before the current dev server started;
   stale tabs show phantom errors ("X is not defined", missing CSS).
5. **Verify visually** at desktop and mobile widths for anything responsive. The site sits behind a
   password gate (`proxy.ts`), so unlock it first. Env vars come from `.env.local`.
6. **Commit and push** specific files (review `git status` first, no blind `git add -A`).
   One-line summary plus a short body explaining why. Push the task branch and open a PR to `integration`.

Cloud sessions have no local browser pane: rely on the build, Playwright screenshots, or the Vercel preview URL.
