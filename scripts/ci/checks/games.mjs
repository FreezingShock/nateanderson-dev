// The games the checks cover. A hand-made game is one registerGame() call here (see registry.mjs and docs/ci.md).
// Games made by `npm run new-game` are listed in scripts/games/games-under-check.json, which that generator edits;
// this file reads that list and registers each entry (the three built-in games must match it).
import { readFileSync } from "node:fs";
import { registerGame, listGames } from "./registry.mjs";

registerGame({
    id: "brasswork",
    name: "Brasswork",
    // Phone layout is full screen by design: no title bar or save footer, so the title-bar checks skip there.
    window: { root: ".bw-root" },
});

registerGame({
    id: "starwright",
    name: "Starwright",
    // Tall phones anchor the Play section under the site bar (PR #690): "Light your star." is no longer hidden behind the bar.
    window: { root: ".sw-root", tallPhoneSection: true },
});

registerGame({
    id: "groundbreak",
    name: "Groundbreak",
    window: { root: ".gb-root" },
    // The fresh seed and the late seed (about 3 h of play, 13 jobs). The late seed found two HUD overlaps the fresh one missed.
    hud: {
        seeds: [{ label: "fresh" }, { label: "late", save: "seeds/groundbreak-late.json" }],
    },
});

registerGame({
    id: "node-farm",
    name: "Node Farm",
    // Framed game route: the page is the game's, and the shell adds the marker, pause and the key guard.
    shell: { gameSelector: '[class*="nf-"]', saveKey: "nf-save-v1" },
});

// Generated games (npm run new-game). Each entry: { id, name, root, template? }.
const underCheck = JSON.parse(readFileSync(new URL("../../games/games-under-check.json", import.meta.url), "utf8"));
for (const entry of underCheck) {
    const known = listGames("window").find((g) => g.id === entry.id);
    if (known) {
        if (known.name !== entry.name || known.window.root !== entry.root) throw new Error(`games-under-check.json and games.mjs disagree about ${entry.id}`);
        continue;
    }
    registerGame({ id: entry.id, name: entry.name, window: { root: entry.root }, template: !!entry.template });
}
