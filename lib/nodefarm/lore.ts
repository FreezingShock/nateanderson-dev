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
    nebula: { code: "NB-CLOUD // DRIFT", zone: "Cloud deck", flavor: "Gas from a star nursery, drifting past the node's highest window. Every cloud you bottle thickens the Chrono.", tiers: ["Dust", "Haze", "Veil", "Pillar", "Nursery", "Cloud deck"] },
    pulsars: { code: "PU-BEACON // PULSE", zone: "Beacon spire", flavor: "Dead stars spinning so fast they keep better time than the quartz. Their beams stir the Nebula.", tiers: ["Blink", "Beat", "Beacon", "Lighthouse", "Magnetar", "Spire"] },
    singularity: { code: "SN-WELL // HORIZON", zone: "Event horizon", flavor: "A point where everything falls in and only signal comes back. It drags the Pulsars round, and pulls a little on everything.", tiers: ["Mote", "Well", "Lens", "Disk", "Horizon", "Singularity"] },
    engrams: { code: "EG-ARCHIVE // RECALL", zone: "Engram archive", flavor: "Everything the node remembers of the people who ran it, played back on loop. It feeds the Singularity, and the Drones pick up old habits.", tiers: ["Fragment", "Recall", "Reel", "Diary", "Archive", "Chorus"] },
    paradox: { code: "PX-MIRROR // FOLD", zone: "Mirror stair", flavor: "Logic folded until both answers are true. It feeds the Engrams, and every Overclock lands twice as hard as it should.", tiers: ["Flicker", "Mirror", "Fork", "Knot", "Recursion", "Mobius"] },
    origin: { code: "OR-ROOT // NODE ZERO", zone: "Root chamber", flavor: "The first node, the one every rack was built around. It feeds the Paradox, and every Ascend comes back with more.", tiers: ["Bit", "Seed", "Root", "Bootstrap", "Kernel", "Node zero"] },
    // Overgrowth: past node zero the roots keep growing, up through the farm
    spores: { code: "SP-CELLAR // SHED", zone: "Spore cellar", flavor: "The roots shed in the old cellar, and the racks down there grew caps. The spores feed back into Origin.", tiers: ["Speck", "Puff", "Cap", "Ring", "Colony", "Cellar"] },
    mycelium: { code: "MY-WEB // GRAFT", zone: "Mycel web", flavor: "Threads that found the cable runs and kept going. The network is half fibre and half fungus now, and it spreads the Spores.", tiers: ["Thread", "Strand", "Mat", "Knot", "Mesh", "Web"] },
    pollen: { code: "PO-CANOPY // LIFT", zone: "Canopy hall", flavor: "The roots reached daylight in the glass hall. The pollen is gold and smells faintly of solder. It feeds the Mycelium.", tiers: ["Grain", "Drift", "Sprig", "Bough", "Grove", "Canopy"] },
    bloom: { code: "BL-HEART // OPEN", zone: "Bloom core", flavor: "The farm in flower, with the reactor in its heart. It feeds the Pollen, and whoever takes the node next gets more Keys for it.", tiers: ["Bud", "Petal", "Flower", "Crown", "Garden", "Bloom"] },
    // Descent: the farm follows its roots down instead, to the heat at the bottom
    basalt: { code: "BA-SHAFT // BORE", zone: "Bedrock shaft", flavor: "Under the cellar the roots stop and the rock starts. Cut it, and the Bloom has something to stand on.", tiers: ["Chip", "Slab", "Column", "Strata", "Bore", "Bedrock"] },
    magma: { code: "MG-LINE // FLOW", zone: "Magma line", flavor: "The farm's last pipeline runs over a river of it. The heat hardens the Basalt as it climbs.", tiers: ["Ember", "Vent", "Seep", "Flow", "Lake", "Caldera"] },
    geodes: { code: "GE-VAULT // HOLLOW", zone: "Geode vault", flavor: "A stone the size of a hall, hollow and lined with light. The racks inside read the crystal like a disk. It cools the Magma into shape.", tiers: ["Pebble", "Nodule", "Druse", "Cavity", "Vault", "Cathedral"] },
    sunstone: { code: "SU-DEEP // BOTTOM", zone: "The buried sun", flavor: "A white sun held in clamps at the bottom of everything. It feeds the Geodes, and warms the whole farm a little.", tiers: ["Spark", "Ingot", "Furnace", "Mantle", "Star", "Sun"] },
};
