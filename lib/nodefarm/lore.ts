// Flavour for Node Farm: each stat's dossier (code name, what it does in-world) and the names of its six button tiers.
import type { StatId } from "./engine";

export interface Lore {
    code: string; // short code name shown on the dossier
    zone: string; // the named area of the node this stat lives in
    flavor: string; // one line in the voice of the node
    tiers: [string, string, string, string, string, string];
}

export const LORE: Record<StatId, Lore> = {
    bytes: { code: "NODE-01 // THROUGHPUT", zone: "Uplink rack", flavor: "Raw packets crossing your node. Everything you build multiplies this one number.", tiers: ["", "", "", "", "", ""] },
    mult: { code: "AMP-STACK // GAIN", zone: "Amp bay", flavor: "Chain amplifiers onto the line. Every unit adds one Byte per second before any boost.", tiers: ["Relay", "Booster", "Amp", "Rack", "Array", "Grid"] },
    reboot: { code: "PWR-CYCLE // PURGE", zone: "Power room", flavor: "Wipe the cache and come back stronger. Resets Bytes and Multipliers, and every Reboot makes Multiplier buttons hit harder.", tiers: ["Warm boot", "Cold boot", "Flush", "Wipe", "Purge", "Genesis"] },
    copper: { code: "CU-LINE // TRACE", zone: "Trace foundry", flavor: "Copper trace lines carry the load. Feeds Reboot power and leaks a little extra into Bytes.", tiers: ["Wire", "Trace", "Coil", "Busbar", "Spool", "Foundry"] },
    silicon: { code: "SI-FAB // WAFER", zone: "Fab cleanroom", flavor: "Wafers etched in a hidden fab. Faster silicon makes the Copper lines run hotter.", tiers: ["Die", "Wafer", "Batch", "Cleanroom", "Fab", "Megafab"] },
    quartz: { code: "QZ-LATTICE // CLOCK", zone: "Crystal vault", flavor: "Resonating crystals keep every wafer in step. More quartz, more silicon per second.", tiers: ["Shard", "Crystal", "Cluster", "Lattice", "Geode", "Cavern"] },
    aether: { code: "AE-CHANNEL // SIGNAL", zone: "Signal void", flavor: "Raw signal from beyond the grid. It tunes the quartz, and enough of it opens Ascend.", tiers: ["Spark", "Wisp", "Current", "Stream", "Vortex", "Rift"] },
    runes: { code: "RN-GLYPH // CARVE", zone: "Glyph hall", flavor: "Signal cut into stone you cannot find on any map. Every glyph tunes the Aether a little finer.", tiers: ["Mark", "Sigil", "Glyph", "Seal", "Canon", "Grimoire"] },
    starglass: { code: "SG-PRISM // REFRACT", zone: "Prism court", flavor: "Light from a dead star, fused into sheets. It makes the Runes burn cleaner.", tiers: ["Chip", "Pane", "Lens", "Prism", "Facet", "Observatory"] },
    voidsteel: { code: "VS-FORGE // HOLLOW", zone: "Hollow forge", flavor: "Metal poured from an empty place. It rings, and the Starglass rings back.", tiers: ["Ingot", "Bar", "Plate", "Anvil", "Crucible", "Abyss"] },
    chrono: { code: "CH-LOOP // STILL", zone: "Still room", flavor: "Time you stopped from leaving. It speeds the Voidsteel, and lends everything a little.", tiers: ["Tick", "Minute", "Hour", "Loop", "Epoch", "Eternity"] },
};
