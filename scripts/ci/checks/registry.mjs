// Registration API for the game checks. A game is plain data: say which parts of the check it takes and the
// selectors and seeds it needs. The suites read the normalised entries from listGames().
//
//   registerGame({
//       id: "my-game",                       // slug: the route is /creations/games/<id>
//       name: "My Game",                     // the data-game name the shell writes on its shell box
//       window: { root: ".mg-root" },        // windowed panel (mode="windowed"); optional views: [...]
//       hud: { seeds: [{ label: "fresh" }, { label: "late", save: "seeds/my-game-late.json" }] }, // optional sizes: [[w, h]...]
//       shell: { gameSelector: '[class*="mg-"]', saveKey: "mg-save-v1" }, // framed game route; optional headerRoute
//   });
//
// Anything left out takes the default below. A game needs at least one of window, hud or shell.
// Save paths are relative to scripts/ci/. Docs: docs/ci.md, "Adding a game to the checks".

/** The three windowed views every windowed game is checked at: desktop, phone (touch) and a short desktop. */
export const WINDOW_VIEWS = [
    { label: "1440", viewport: { width: 1440, height: 900 }, hasTouch: false },
    { label: "390", viewport: { width: 390, height: 844 }, hasTouch: true },
    { label: "1366x657", viewport: { width: 1366, height: 657 }, hasTouch: false },
];

/** The seven sizes the Groundbreak HUD check covers: desktop, phones in both orientations and short landscape screens. */
export const HUD_SIZES = [
    [1440, 900],
    [390, 844],
    [360, 740],
    [375, 667],
    [844, 390],
    [932, 430],
    [667, 375],
];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const games = [];

export function registerGame(config) {
    const id = config?.id;
    if (typeof id !== "string" || !SLUG.test(id)) throw new Error(`registerGame: id must be a lowercase slug, got ${JSON.stringify(id)}`);
    if (games.some((g) => g.id === id)) throw new Error(`registerGame: "${id}" is already registered`);
    if (typeof config.name !== "string" || !config.name) throw new Error(`registerGame("${id}"): name is required`);
    if (!config.window && !config.hud && !config.shell) throw new Error(`registerGame("${id}"): give it at least one of window, hud or shell`);

    const game = { id, name: config.name, route: `/creations/games/${id}`, window: null, hud: null, shell: null };

    if (config.window) {
        if (typeof config.window.root !== "string" || !config.window.root) throw new Error(`registerGame("${id}"): window.root must be a selector`);
        game.window = { root: config.window.root, views: config.window.views ?? WINDOW_VIEWS };
    }

    if (config.hud) {
        const seeds = config.hud.seeds ?? [{ label: "fresh" }];
        for (const seed of seeds) {
            if (typeof seed.label !== "string" || !seed.label) throw new Error(`registerGame("${id}"): every hud seed needs a label`);
        }
        const sizes = config.hud.sizes ?? HUD_SIZES;
        game.hud = { seeds, sizes: sizes.map(([width, height]) => ({ width, height })) };
    }

    if (config.shell) {
        if (typeof config.shell.gameSelector !== "string" || !config.shell.gameSelector) throw new Error(`registerGame("${id}"): shell.gameSelector must be a selector`);
        game.shell = {
            gameSelector: config.shell.gameSelector,
            saveKey: config.shell.saveKey ?? null,
            headerRoute: config.shell.headerRoute ?? null,
        };
    }

    games.push(game);
    return game;
}

/** Registered games, in registration order. Pass a suite name ("window", "hud", "shell") to keep only the games that suite checks. */
export function listGames(suite) {
    return suite ? games.filter((g) => g[suite]) : games.slice();
}
