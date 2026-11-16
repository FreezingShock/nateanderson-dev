// The games the checks cover. Adding a game is one registerGame() call here (see registry.mjs for the fields and docs/ci.md).
import { registerGame } from "./registry.mjs";

registerGame({
    id: "brasswork",
    name: "Brasswork",
    // Phone layout is full screen by design: no title bar or save footer, so the title-bar checks skip there.
    window: { root: ".bw-root" },
});

registerGame({
    id: "starwright",
    name: "Starwright",
    window: { root: ".sw-root" },
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
