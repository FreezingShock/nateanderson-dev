// The save slot of every game: the localStorage key, the envelope app id and the current save version. Plain data, no engine
// imports, so the shell, the console and the export/import code can read it without pulling any engine into a route.
// Each engine's save definition (lib/<game>/save.ts) reads its entry from here, so a key is written in exactly one place.

export const SAVE_SLOTS = {
    brasswork: { app: "brasswork", key: "brasswork-save-v1", version: 1 },
    starwright: { app: "starwright", key: "sw-save-v1", version: 1 },
    groundbreak: { app: "groundbreak", key: "gb-save-v1", version: 2 },
    "node-farm": { app: "node-farm", key: "nf-save-v1", version: 1 },
    // gen-anchor: slots
} as const;

export type SaveGame = keyof typeof SAVE_SLOTS;

/** Keys the saves share with the rest of a game. Listed here so a rename shows up in one diff. */
export const SAVE_KEYS = {
    starwrightAway: "sw-away-v1",
    nodeFarmBackups: "nf-backups-v1",
    nodeFarmLegacyBackup: "nf-backup-v1",
} as const;
