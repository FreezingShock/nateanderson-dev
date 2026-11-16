// Node Farm's save slot. The live save is the shared envelope (lib/saves/core.ts) around the game's own JSON, so
// parseSave (lib/nodefarm/engine.ts) reads both the envelope and the bare text that backups and exports carry.
import { SAVE_SLOTS } from "../saves/keys";
import { encodeData } from "../saves/core";

const slot = SAVE_SLOTS["node-farm"];
export const NF_APP = slot.app;
export const NF_KEY = slot.key;
export const NF_VERSION = slot.version;

/** The live save as stored: the envelope around the game's state. */
export const nfSaveText = (state: unknown, now: number = Date.now()): string => encodeData(NF_APP, NF_VERSION, state, now);
