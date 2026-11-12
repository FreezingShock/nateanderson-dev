// Node Farm engine: pure game rules, no React and no imports, so the pacing sim (scripts/nodefarm/sim.mjs) can run it
// directly in Node. Numbers are plain doubles; a full run stays far below 1e308.

/** Producer materials in chain order. Each is paid in the one before it (Copper in Bytes) and boosts that one in turn. */
export const MATS = ["copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "nebula", "pulsars", "singularity", "engrams", "paradox", "origin", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"] as const;
/** The two arcs past Root Chamber (Overgrowth, then Descent). They stay shut until the first Handover. */
export const ARC_MATS: readonly MatId[] = ["spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone"];
export type MatId = (typeof MATS)[number];
export type StatId = "bytes" | "mult" | "reboot" | MatId;
export type ButtonStat = Exclude<StatId, "bytes">;

export const TIERS = 6;

export interface StatDef {
    id: StatId;
    name: string;
    short: string;
    /** one line on what the stat does, shown on the row */
    role: string;
    /** the stat that pays for this one's buttons */
    pays?: StatId;
    color: string;
}

export const STATS: StatDef[] = [
    { id: "bytes", name: "Bytes", short: "B", role: "The base stat. Earned every second.", color: "#2fd8e8" },
    { id: "mult", name: "Multipliers", short: "MUL", role: "Each one adds to your Bytes per second.", pays: "bytes", color: "#b6f04a" },
    { id: "reboot", name: "Reboots", short: "RBT", role: "Resets Bytes and Multipliers. Makes every Multiplier button hit harder.", pays: "mult", color: "#ff2d8a" },
    { id: "copper", name: "Copper", short: "CU", role: "Trace lines. Boosts Reboots and adds a little to Bytes.", pays: "bytes", color: "#f08a3c" },
    { id: "silicon", name: "Silicon", short: "SI", role: "Wafers. Boosts Copper.", pays: "copper", color: "#7aa2ff" },
    { id: "quartz", name: "Quartz", short: "QZ", role: "Resonators. Boosts Silicon.", pays: "silicon", color: "#e08cff" },
    { id: "aether", name: "Aether", short: "AE", role: "Raw signal. Boosts Quartz, and unlocks Ascend.", pays: "quartz", color: "#6bffc9" },
    { id: "runes", name: "Runes", short: "RN", role: "Carved signal. Boosts Aether.", pays: "aether", color: "#ffc53a" },
    { id: "starglass", name: "Starglass", short: "SG", role: "Fused starlight. Boosts Runes.", pays: "runes", color: "#bfeaff" },
    { id: "voidsteel", name: "Voidsteel", short: "VS", role: "Metal from an empty place. Boosts Starglass.", pays: "starglass", color: "#9a7bff" },
    { id: "chrono", name: "Chrono", short: "CH", role: "Held time. Boosts Voidsteel and everything a little.", pays: "voidsteel", color: "#ff7a4a" },
    { id: "nebula", name: "Nebula", short: "NB", role: "Star-nursery gas. Boosts Chrono.", pays: "chrono", color: "#ff8ad8" },
    { id: "pulsars", name: "Pulsars", short: "PU", role: "Dead stars that keep perfect time. Boost Nebula.", pays: "nebula", color: "#64e6ff" },
    { id: "singularity", name: "Singularity", short: "SN", role: "A point everything falls into. Boosts Pulsars, and pulls on everything a little.", pays: "pulsars", color: "#ffb14a" },
    { id: "engrams", name: "Engrams", short: "EG", role: "Recorded memory. Boosts Singularity, and Drones press faster.", pays: "singularity", color: "#e8b98a" },
    { id: "paradox", name: "Paradox", short: "PX", role: "Folded logic. Boosts Engrams, and Overclock hits harder.", pays: "engrams", color: "#dfe3f5" },
    { id: "origin", name: "Origin", short: "OR", role: "The first node. Boosts Paradox, and every Ascend pays more AP.", pays: "paradox", color: "#3dff6e" },
    { id: "spores", name: "Spores", short: "SP", role: "What the roots shed past node zero. Boost Origin.", pays: "origin", color: "#5cf0c0" },
    { id: "mycelium", name: "Mycelium", short: "MY", role: "Roots grown into a network. Boosts Spores.", pays: "spores", color: "#c8bdff" },
    { id: "pollen", name: "Pollen", short: "PO", role: "Carried up into the light. Boosts Mycelium.", pays: "mycelium", color: "#f2e44a" },
    { id: "bloom", name: "Bloom", short: "BL", role: "The farm in flower. Boosts Pollen, and every Handover pays more Keys.", pays: "pollen", color: "#ff7aa0" },
    { id: "basalt", name: "Basalt", short: "BA", role: "Rock under the roots. Boosts Bloom.", pays: "bloom", color: "#8e99a8" },
    { id: "magma", name: "Magma", short: "MG", role: "Heat on the way down. Boosts Basalt.", pays: "basalt", color: "#ff9a2a" },
    { id: "geodes", name: "Geodes", short: "GE", role: "Hollow stones full of light. Boost Magma.", pays: "magma", color: "#c77aff" },
    { id: "sunstone", name: "Sunstone", short: "SU", role: "A buried sun at the bottom of everything. Boosts Geodes, and everything a little.", pays: "geodes", color: "#ffd04a" },
];

export const statDef = (id: StatId) => STATS.find((s) => s.id === id)!;

// ---- tuning (see docs/node-farm.md). Every number lives here so pacing can be changed in one place.
export const TUNE = {
    // button price = base * ratio^tier * growth^timesBought
    cost: {
        mult: { base: 8, ratio: 8, growth: 1.08 },
        copper: { base: 2000, ratio: 10, growth: 1.12 },
        silicon: { base: 200, ratio: 10, growth: 1.12 },
        quartz: { base: 900, ratio: 10, growth: 1.12 },
        aether: { base: 3500, ratio: 10, growth: 1.12 },
        runes: { base: 30, ratio: 10, growth: 1.12 },
        starglass: { base: 40, ratio: 10, growth: 1.12 },
        voidsteel: { base: 50, ratio: 10, growth: 1.12 },
        chrono: { base: 60, ratio: 10, growth: 1.12 },
        nebula: { base: 30, ratio: 10, growth: 1.12 },
        pulsars: { base: 25, ratio: 10, growth: 1.12 },
        singularity: { base: 20, ratio: 10, growth: 1.12 },
        engrams: { base: 15, ratio: 10, growth: 1.12 },
        paradox: { base: 10, ratio: 10, growth: 1.12 },
        origin: { base: 6, ratio: 10, growth: 1.12 },
        spores: { base: 5, ratio: 10, growth: 1.12 },
        mycelium: { base: 5, ratio: 10, growth: 1.12 },
        pollen: { base: 4, ratio: 10, growth: 1.12 },
        bloom: { base: 4, ratio: 10, growth: 1.12 },
        basalt: { base: 4, ratio: 10, growth: 1.12 },
        magma: { base: 3, ratio: 10, growth: 1.12 },
        geodes: { base: 3, ratio: 10, growth: 1.12 },
        sunstone: { base: 3, ratio: 10, growth: 1.12 },
    } as Record<string, { base: number; ratio: number; growth: number }>,
    // how much one press of tier k adds (Multipliers, or producers for materials)
    gainBase: { mult: 1, copper: 1, silicon: 1, quartz: 1, aether: 1, runes: 1, starglass: 1, voidsteel: 1, chrono: 1, nebula: 1, pulsars: 1, singularity: 1, engrams: 1, paradox: 1, origin: 1, spores: 1, mycelium: 1, pollen: 1, bloom: 1, basalt: 1, magma: 1, geodes: 1, sunstone: 1 } as Record<string, number>,
    gainRatio: 5,
    // reboot tier k: costs rebootBase * rebootRatio^k * rebootGrowth^R Multipliers, adds rebootGainRatio^k Reboots
    rebootBase: 100,
    rebootRatio: 4.5,
    rebootGrowth: 1.12,
    rebootGainRatio: 2.6,
    rebootStrength: 0.7, // each Reboot adds this much to Multiplier button gains
    perProducer: { copper: 0.05, silicon: 0.03, quartz: 0.016, aether: 0.008, runes: 0.0025, starglass: 0.0012, voidsteel: 0.0006, chrono: 0.0003, nebula: 0.0002, pulsars: 0.00017, singularity: 0.00016, engrams: 0.00015, paradox: 0.00008, origin: 0.00004, spores: 0.00003, mycelium: 0.000025, pollen: 0.00002, bloom: 0.000016, basalt: 0.000012, magma: 0.00001, geodes: 0.000008, sunstone: 0.000006 } as Record<string, number>,
    boostK: { cuReboot: 0.09, cuBytes: 0.02, siCu: 0.2, qzSi: 0.2, aeQz: 0.2, ruAe: 0.12, sgRu: 0.12, vsSg: 0.12, chVs: 0.12, chAll: 0.03, nbCh: 0.12, puNb: 0.12, snPu: 0.12, egSn: 0.12, pxEg: 0.12, orPx: 0.12, spOr: 0.12, mySp: 0.12, poMy: 0.12, blPo: 0.12, baBl: 0.12, mgBa: 0.12, geMg: 0.12, suGe: 0.12 },
    // the extras on the last three materials grow with log10 of the amount, so they cannot feed back into a runaway
    logK: { snAll: 0.1, egDrone: 0.15, pxOc: 0.15, orAp: 0.1, crosstalk: 0.12, blKeys: 0.1, suAll: 0.08 },
    boostPow: 0.38,
    chAllCap: 1e6, // Chrono boosts EVERYTHING, including Chrono: past this amount the boost grows only with log10 (a power law fed itself to 1e300 once Engrams opened)
    unlockAt: { copper: 1, silicon: 150, quartz: 300, aether: 500, runes: 150, starglass: 200, voidsteel: 250, chrono: 300, nebula: 300, pulsars: 300, singularity: 300, engrams: 350, paradox: 400, origin: 450, spores: 500, mycelium: 550, pollen: 600, bloom: 650, basalt: 700, magma: 750, geodes: 800, sunstone: 850 } as Record<string, number>, // copper: Reboots; the rest: amount of the stat below
    overclockMult: 6,
    overclockSecs: 20,
    offlineCapHours: 8,
    ascendAether: 400,
    apPerAether: 60, // AP = floor((aether / apPerAether)^apPow + (runes / apPer.runes)^apPow + ...)
    apPer: { runes: 90, starglass: 45, voidsteel: 27, chrono: 14, nebula: 8, pulsars: 4, singularity: 2, engrams: 1, paradox: 0.5, origin: 0.2, spores: 0.1, mycelium: 0.05, pollen: 0.025, bloom: 0.012, basalt: 0.006, magma: 0.003, geodes: 0.0015, sunstone: 0.0008 } as Record<string, number>,
    apPow: 0.3, // AP grows with amount^apPow; a low power stops Ascends from snowballing
    apBonus: 0.3,
    achBonus: 0.02,
    arcBonus: 0.05, // global bonus for each arc whose every button has been pressed at least once (lib/nodefarm/arcs.ts)
    tierBonus: 0.08, // extra global bonus for each fully completed goal tier
    // Drones: one per button tier, bought with Aether. Each level presses that tier's button on every armed stat, droneRate times a second.
    drone: { max: 10, base: 25, ratio: 6, growth: 1.7, rate: 0.25, offline: 0.5, burst: 200 },
    autoReserve: 10, // the Autoloader only buys when the balance is at least this many times the price
    treeCost: 1, // scales every tree node price (pacing knob for the sim)
    apBonusFromEarned: false, // true: the AP bonus also counts AP spent on nodes and perks. Off because the sim then finishes the tree in 12 to 19 h (AP feeds itself); spending AP is the brake
    watchdogReserve: 1.5, // Watchdog timer Reboots once you hold this many times the price in Multipliers
    dropHours: 4, // Dead drop fills over this many real hours
    dropPays: 3600, // seconds of production in a Dead drop
    zeroDayPays: 600, // seconds of production in a Zero-day payout
    mountKeep: 1, // fraction of a mounted material's producers kept through Ascend
    apSoft: 100, // past this many AP, each extra AP counts less toward the global bonus (AP^apSoftPow), so Ascends cannot run away
    apSoftPow: 0.5,
    rankCost: 1.6, // each rank of a ranked tree node costs this much more than the last
    coldStartSecs: 90, // Cold start: how long the Bytes boost lasts after each Reboot
    longHaulMins: 4, // Long haul: Bytes gain +100% for every this many minutes since the last Reboot
    longHaulMax: 8, // ...up to this many extra
    frenzySecs: 60, // Swarm alarm: how long the Drone frenzy lasts after an event win
    frenzyX: 4, // ...and how much faster they press
    apGainSoft: 250, // past this many AP in one Ascend, the rest grows with the log of the raw amount, so late Ascends cannot run away (0 = off)
};

export interface PerkDef {
    id: "scanner" | "auto" | "overclock" | "offline" | "start" | "power";
    name: string;
    blurb: string;
    max: number;
    cost: (lvl: number) => number;
}

export const PERKS: PerkDef[] = [
    { id: "power", name: "Power core", blurb: "+15% to everything per level.", max: 20, cost: (l) => 1 + l },
    { id: "scanner", name: "Wide-band scanner", blurb: "Quick-time events arrive 8% sooner per level.", max: 6, cost: (l) => 1 + l },
    { id: "auto", name: "Autoloader", blurb: "Buys one stat per level by itself, with no script needed (Multipliers, then each material up the chain).", max: 12, cost: (l) => 3 + l * 2 },
    { id: "overclock", name: "Overclock coils", blurb: "Overclocks last +5 s longer per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "offline", name: "Standby cells", blurb: "Standby window +4 hours per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "start", name: "Cold cache", blurb: "Start each Reboot with 10 seconds of Bytes per level.", max: 10, cost: (l) => 1 + Math.floor(l / 2) },
];

// ---- prestige tree: 40 nodes in five sections around a free core, bought with AP and kept through every Ascend.
// Each section is a diamond: an entry node by the core, two paths of three, and a keystone at the far end. Every node
// does one distinct thing (Nate, 2026-11-12: fewer, bigger, unique upgrades). Keystones are pure boosts with no
// trade-offs, respec is free and refunds all AP. Node list and wording: docs/node-farm.md "Prestige tree".
export interface TreeFx {
    bytes?: number; // Bytes per second x(1 + this)
    global?: number; // everything x(1 + this)
    reboot?: number; // Reboot power x(1 + this)
    multGain?: number; // Multiplier buttons add x(1 + this)
    discount?: number; // buttons cost this fraction less
    mats?: Partial<Record<MatId, number>>; // that material's output x(1 + this)
    start?: number; // extra seconds of Bytes kept on a Reboot
    offline?: number; // extra hours of offline banking
    overclock?: number; // extra seconds on an Overclock
    ocMult?: number; // added to the Overclock multiplier
    ap?: number; // AP on Ascend x(1 + this)
    goals?: number; // added to what each goal and secret gives
    drone?: number; // Drone press speed x(1 + this)
    droneMax?: number; // extra Drone levels per tier
    droneCost?: number; // Drones cost this fraction less
    droneOff?: number; // added to Drone speed while away (base 0.5)
    // added with the 40-node tree
    apEach?: number; // what each AP gives (TUNE.apBonus) x(1 + this), summed
    growth?: number; // button prices climb this fraction slower per purchase
    rebootKeep?: number; // fraction of Multipliers kept on a Reboot
    unlockMul?: number; // materials open at this fraction of the usual amount
    kitReboot?: number; // every Ascend starts with this many Reboots
    kitProd?: Partial<Record<MatId, number>>; // every Ascend starts with these producers
    kitDrones?: number; // every Ascend starts with each Drone at least this level
    droneKeep?: number; // fraction of Drone levels kept through Ascend
    droneGlobal?: number; // everything +this per Drone level owned
    mounts?: number; // Mounted drive slots
    eventRate?: number; // quick-time events come this fraction sooner
    ocTime?: number; // Overclock length x(1 + this)
    ocX?: number; // Overclock multiplier x(1 + this)
    winBoost?: number; // everything +this per event win, until the next Ascend
    zeroDay?: number; // chance an event win also pays 10 minutes of production
    echo?: number; // chance an event win brings the next event right away
    // added with the deeper tree (junctions, forks, ranked nodes)
    coldStart?: number; // Bytes x(1 + this) for TUNE.coldStartSecs after every Reboot
    longHaul?: number; // Bytes grow with time since the last Reboot (1 = on)
    specialist?: number; // the newest material you produce x(1 + this)
    perNode?: number; // everything +this per tree node (and rank) owned
    spearhead?: number; // the highest Drone tier you own presses x(1 + this)
    winPay?: number; // every event win pays this many seconds of production
    busbar?: number; // materials x(1 + this * log10(1 + Reboots))
    apPerMat?: number; // AP on Ascend +this per material you produce
    droneTierGoal?: number; // extra Drone levels per completed goal tier
    frenzy?: number; // an event win sends the Drones into a frenzy (1 = on)
    ocReboot?: number; // Reboot power x(1 + this) during an Overclock
    feature?: Feature;
}
/** Systems a node switches on. The UI checks them with `hasFeature`. */
export type Feature = "watchdog" | "forecast" | "deaddrop" | "orders" | "ghostline" | "crosstalk" | "duck";
export type TreeKind = "minor" | "notable" | "keystone";
export type Branch = "signal" | "forge" | "systems" | "drones" | "anomaly";
export type NodeVis = "shown" | "fog" | "hidden";
export interface TreeNode {
    id: string;
    branch: Branch;
    kind: TreeKind;
    name: string;
    /** the effect, one plain line */
    blurb: string;
    /** one short lore line for the tooltip */
    flavor: string;
    cost: number;
    /** section slot, 0 to 7 (set by the layout) */
    slot?: number;
    /** neighbours (both directions); "core" is the free start */
    links: string[];
    fx: TreeFx;
    /** position in tree units (the menu multiplies by its grid size) */
    x: number;
    y: number;
    /** sprite cell: the node's index in TREE */
    ix: number;
    /** sprite key for the art sheet (the node id) */
    sprite: string;
    /** the section's first node, next to the core */
    entry?: boolean;
    /** part of a chain with rising cost, such as Carrier I to III */
    chain?: { id: string; step: number; of: number };
    /** the deeper tree (2026-11-12): junctions, forks and ranked nodes. Absent on the first 40. */
    form?: "junction" | "fork" | "ranked";
    /** junction: every one of these must be owned (both sections), not just one neighbour */
    req?: string[];
    /** fork: the other side of the pair. Owning one locks the other; buying the other swaps for free */
    excl?: string;
    /** ranked: how many times it can be bought (the price climbs by TUNE.rankCost each time) */
    ranks?: number;
}
export const BRANCHES: { id: Branch; name: string; blurb: string; color: string }[] = [
    { id: "signal", name: "Signal", blurb: "Bytes, Reboots and prices.", color: "#2fd8e8" },
    { id: "forge", name: "Forge", blurb: "Materials, from Copper to Chrono.", color: "#ffc53a" },
    { id: "systems", name: "Systems", blurb: "Time away, goals and AP.", color: "#6bffc9" },
    { id: "drones", name: "Drones", blurb: "More Drones, faster Drones, Drones that remember.", color: "#ff4d6d" },
    { id: "anomaly", name: "Anomaly", blurb: "Quick-time events, Overclock and odd things.", color: "#9a7bff" },
];
// Slot layout per section, in units along the arm (u) and sideways (v), with the slots each one links back to.
// 0 entry | 1, 3, 5 the upper path | 2, 4, 6 the lower path | 7 keystone. Spacing keeps big nodes apart (>= 1.8 units, 2.3 by the keystone).
const SLOTS: [number, number, number[]][] = [
    [2.4, 0, []], [4.0, -1.2, [0]], [4.0, 1.2, [0]], [5.8, -1.7, [1]], [5.8, 1.7, [2]], [7.6, -1.2, [3]], [7.6, 1.2, [4]], [9.6, 0, [5, 6]],
];
const SLOT_COST = [4, 10, 12, 24, 24, 48, 48, 140];
// Past each keystone (the deeper tree): 8 and 9 are a fork pair, 10 is the ranked tip that opens from either fork.
const OUTER: [number, number, number[]][] = [[11.5, -1.3, [7]], [11.5, 1.3, [7]], [13.4, 0, [8, 9]]];
const OUTER_COST = [400, 400, 200];
type Row = [slot: number, id: string, kind: TreeKind, name: string, blurb: string, flavor: string, fx: TreeFx, cost?: number];
const ALL_MATS = (v: number) => Object.fromEntries(MATS.map((m) => [m, v])) as Record<MatId, number>;
const ARMS: Record<Branch, Row[]> = {
    signal: [
        [0, "linecode", "minor", "Line coding", "Bytes x2.", "Clean edges on every bit. The wire finally sounds like a wire.", { bytes: 1 }],
        [2, "echocancel", "minor", "Echo cancel", "Reboots keep 10% of your Multipliers.", "Most of the signal survives the restart. The rest was noise anyway.", { rebootKeep: 0.1 }],
        [3, "headstart", "minor", "Head start", "Every Ascend starts with 25 Reboots.", "The node remembers the way back. It just needs a push.", { kitReboot: 25 }],
        [4, "hotswap", "minor", "Hot swap", "Reboot power x2.", "Swapped the board while it was still warm. It did not notice.", { reboot: 1 }],
        [5, "watchdog", "notable", "Watchdog timer", "Auto-Reboot: Reboots for you at the best tier you can afford. Switch it on the Reboot row.", "A timer that kicks the node when it stalls. The node has stopped stalling.", { feature: "watchdog" }],
        [6, "flatrate", "notable", "Flat rate", "Button prices climb 40% slower each time you buy.", "Renegotiated with the grid. They did not read the fine print.", { growth: 0.4 }],
        [7, "overdrive", "keystone", "Overdrive", "Everything x3.", "Past the red line the hum goes quiet. That is when it works hardest.", { global: 2 }],
        [8, "coldstart", "notable", "Cold start", "For 90 s after every Reboot, Bytes x10.", "The first breath after a restart is the loudest.", { coldStart: 9 }],
        [9, "longhaul", "notable", "Long haul", "Bytes +100% for every 4 minutes since your last Reboot, up to x9.", "Leave it running long enough and it stops asking why.", { longHaul: 1 }],
        [10, "clockskew", "keystone", "Clock skew", "Bytes x1.5 per rank.", "Ran the clock a hair fast. Nobody has complained yet.", { bytes: 0.5 }],
    ],
    forge: [
        [0, "furnace", "minor", "Furnace tuning", "Copper and Silicon x2.", "Hotter, steadier, cleaner. The slag pile is shrinking.", { mats: { copper: 1, silicon: 1 } }],
        [1, "prospect", "minor", "Prospector kit", "Every Ascend starts with 10 producers each of Copper, Silicon and Quartz.", "Packed the good picks before the room went dark.", { kitProd: { copper: 10, silicon: 10, quartz: 10 } }],
        [2, "assay", "minor", "Assay", "Every material opens at half the usual amount.", "Test the ore before you dig. Saves half the digging.", { unlockMul: 0.5 }],
        [3, "mount1", "notable", "Mounted drive I", "Pick one material on the Ascend pane. Its producers survive every Ascend.", "Bolted a drive to the floor. The dark cannot take what is bolted down.", { mounts: 1 }],
        [4, "deepvein", "minor", "Deep vein", "Runes, Starglass, Voidsteel and Chrono x2.", "The seam keeps going past where the map ends.", { mats: { runes: 1, starglass: 1, voidsteel: 1, chrono: 1 } }],
        [5, "mount2", "minor", "Mounted drive II", "A second mounted drive.", "Second drive, same bolts. The floor is getting crowded.", { mounts: 1 }],
        [6, "crosstalk", "notable", "Cross-talk", "Every material also boosts the one two steps down the chain.", "The materials started talking past their neighbours. I let them.", { feature: "crosstalk" }],
        [7, "overpress", "keystone", "Overpressure", "Every material x3.", "Every pipe at full pressure. The forge sings one long note.", { mats: ALL_MATS(2) }],
        [8, "specialist", "notable", "Specialist", "The newest material you produce x8.", "Pick one seam and dig until it rings.", { specialist: 7 }],
        [9, "generalist", "notable", "Generalist", "Every material x2.5.", "A little of everything, all of it hot.", { mats: ALL_MATS(1.5) }],
        [10, "alloy", "keystone", "Alloy", "Every material x1.4 per rank.", "Mix two metals and both forget what they were.", { mats: ALL_MATS(0.4) }],
    ],
    systems: [
        [0, "standby", "minor", "Standby plus", "Standby window +8 hours.", "Bigger cells, longer naps.", { offline: 8 }],
        [1, "carrier1", "minor", "Carrier I", "Each AP adds a third more to everything.", "Boosted the carrier. The points carry further.", { apEach: 1 / 3 }],
        [2, "forecast", "minor", "Forecast", "Every button shows how long until you can afford it.", "Every price comes with an arrival time now.", { feature: "forecast" }],
        [3, "carrier2", "notable", "Carrier II", "Each AP adds another third more.", "Louder carrier, same message, more of it lands.", { apEach: 1 / 3 }],
        [4, "ledger", "minor", "Ledger", "Each goal and secret gives +4%.", "Wrote down every win. The node reads the list at night.", { goals: 0.02 }],
        [5, "carrier3", "minor", "Carrier III", "Each AP adds another third more: twice the bonus with all three.", "The carrier is all you hear now.", { apEach: 1 / 3 }],
        [6, "deaddrop", "notable", "Dead drop", "A cache fills over 4 hours of real time, even while away. Open it for 1 hour of production.", "Someone leaves a box at the node. No note. Always the right size.", { feature: "deaddrop" }],
        [7, "coldstore", "keystone", "Cold storage", "AP from every Ascend x2.", "Packed the whole run in ice. It thaws worth twice as much.", { ap: 1 }],
        [8, "hoarder", "notable", "Hoarder", "Each unspent AP adds half again as much to everything.", "Kept the points in a jar. The jar hums.", { apEach: 0.5 }],
        [9, "investor", "notable", "Investor", "+4% to everything for every tree node and rank you own.", "Every node pays a little rent to the others.", { perNode: 0.04 }],
        [10, "archive", "keystone", "Archive", "AP from every Ascend x1.08 per rank.", "Every run gets filed. The filing cabinet is worth something now.", { ap: 0.08 }],
    ],
    drones: [
        [0, "wake", "minor", "Wake routine", "Every Ascend starts with a level 1 Drone on every tier.", "They boot before I do.", { kitDrones: 1 }],
        [1, "sparecell", "minor", "Spare cells", "Drones go up to level 13.", "Extra cells in every chassis. Heavier, happier.", { droneMax: 3 }],
        [2, "orders", "minor", "Standing orders", "New stats are armed for Drones the moment they open.", "Told them once. They remember.", { feature: "orders" }],
        [3, "overwatch", "minor", "Overwatch", "Drones press twice as fast.", "One watches, one presses, they swap every hour.", { drone: 1 }],
        [4, "bulkorder", "minor", "Bulk order", "Drones cost 50% less Aether.", "Bought them by the crate. The crate was cheaper than the box.", { droneCost: 0.5 }],
        [5, "graveyard", "notable", "Graveyard shift", "Drones work at full speed while you are away.", "Nobody told them it was night.", { droneOff: 0.5 }],
        [6, "hivemem", "notable", "Hive memory", "Drones keep half their levels through every Ascend.", "They remember the old floor plan.", { droneKeep: 0.5 }],
        [7, "swarm", "keystone", "Swarm protocol", "Each Drone level adds +3% to everything.", "A hundred small hands, one big push.", { droneGlobal: 0.03 }],
        [8, "widenet", "notable", "Wide net", "Every Drone presses 60% faster.", "Spread thin and everywhere at once.", { drone: 0.6 }],
        [9, "spearhead", "notable", "Spearhead", "Your highest-tier Drone presses x6.", "One Drone out front. The rest follow its lights.", { spearhead: 5 }],
        [10, "firmware", "keystone", "Firmware", "Drones press 30% faster per rank.", "Flashed them again. They boot a little smarter each time.", { drone: 0.3 }],
    ],
    anomaly: [
        [0, "static", "minor", "Static", "Quick-time events come 30% more often.", "There is always someone on the line now.", { eventRate: 0.3 }],
        [1, "longfuse", "minor", "Long fuse", "Overclocks last twice as long.", "Slower burn, same bang.", { ocTime: 1 }],
        [2, "duck", "minor", "Rubber duck", "Does nothing. Listens, though.", "Explained the whole farm to it. Found two bugs.", { feature: "duck" }, 1],
        [3, "resonant", "minor", "Resonant noise", "Overclock is x12.", "Tuned the static until it hums in key.", { ocMult: 6 }],
        [4, "ghostline", "minor", "Ghost line", "Winning an event during an Overclock adds its time instead of restarting it.", "Two boosts, one wire. They queue politely.", { feature: "ghostline" }],
        [5, "echo", "notable", "Echo", "Winning an event has a 1 in 3 chance to bring the next one right away.", "Answered the knock and something knocked back.", { echo: 1 / 3 }],
        [6, "zeroday", "notable", "Zero-day", "One in five event wins also pays 10 minutes of production.", "An open door nobody else has found yet.", { zeroDay: 0.2 }],
        [7, "spike", "keystone", "Spike protocol", "Overclock x2 again, and every event win adds +2% to everything until the next Ascend.", "Every knock makes the node a little louder.", { ocX: 1, winBoost: 0.02 }],
        [8, "storm", "notable", "Storm chaser", "Quick-time events come 50% more often.", "Stopped waiting for the knock. Started going looking.", { eventRate: 0.5 }],
        [9, "patient", "notable", "Patient", "Every event win also pays 5 minutes of production.", "Let it knock twice. The second knock brings gifts.", { winPay: 300 }],
        [10, "afterimage", "keystone", "Afterimage", "Overclock x1.15 per rank.", "The boost leaves a shape on the screen after it ends.", { ocX: 0.15 }],
    ],
};
// Junctions sit between two neighbouring sections and need the node on each side (arm slot 6 and the next arm's slot 5).
// Keyed by the first section; the second is the next one round the core.
type JRow = [id: string, name: string, blurb: string, flavor: string, fx: TreeFx];
const JUNCTIONS: Record<Branch, JRow> = {
    signal: ["busbar", "Bus bar", "Every material grows with your Reboots this run: x2 at 100, x2.5 at 1,000.", "Tied the Reboot line straight into the forge. Every restart stokes it.", { busbar: 0.5 }],
    forge: ["manifest", "Manifest", "AP from every Ascend +5% for each material you produce.", "Counted every crate on the way out. They count for more now.", { apPerMat: 0.05 }],
    systems: ["nightcrew", "Night crew", "+1 Drone level cap for every completed goal tier.", "Every badge on the wall buys one more pair of hands.", { droneTierGoal: 1 }],
    drones: ["swarmalarm", "Swarm alarm", "Winning an event sends the Drones into a frenzy: x4 speed for 60 s.", "The alarm goes off and they all wake up angry.", { frenzy: 1 }],
    anomaly: ["feedback", "Feedback loop", "During an Overclock, Reboot power x3.", "Pointed the mic at the speaker. The whole node screamed in tune.", { ocReboot: 2 }],
};
const JUNCTION_COST = 160;
const RANKS = 5;
const CHAINS: Record<string, [string, number, number]> = { carrier1: ["carrier", 1, 3], carrier2: ["carrier", 2, 3], carrier3: ["carrier", 3, 3], mount1: ["mount", 1, 2], mount2: ["mount", 2, 2] };
const ARM_ORDER: Branch[] = ["signal", "forge", "systems", "drones", "anomaly"];
function buildTree(): TreeNode[] {
    const out: TreeNode[] = [];
    const byId = (id: string) => out.find((n) => n.id === id)!;
    const link = (a: string, b: string) => { byId(a).links.push(b); byId(b).links.push(a); };
    const slotIds: Record<string, string[]> = {};
    const all = [...SLOTS, ...OUTER];
    // two passes so the first 40 keep their old order (ix), and the deeper nodes come after them
    for (const pass of [0, 1]) ARM_ORDER.forEach((arm, ai) => {
        const th = -Math.PI / 2 + (ai * 2 * Math.PI) / ARM_ORDER.length;
        const c = Math.cos(th), sn = Math.sin(th);
        const ids: string[] = (slotIds[arm] ??= []);
        for (const [slot, id, kind, name, blurb, flavor, fx, price] of ARMS[arm]) {
            if ((slot >= SLOTS.length ? 1 : 0) !== pass) continue;
            const [u, v] = all[slot];
            const ch = CHAINS[id];
            const outer = slot >= SLOTS.length;
            const form = !outer ? undefined : slot === 10 ? "ranked" : "fork";
            const base = price ?? (outer ? OUTER_COST[slot - SLOTS.length] : SLOT_COST[slot] * (kind === "notable" ? 1.3 : 1));
            out.push({
                id, branch: arm, kind, name, blurb, flavor, fx,
                cost: Math.round(base * TUNE.treeCost),
                links: slot === 0 ? ["core"] : [],
                x: +(u * c - v * sn).toFixed(3), y: +(u * sn + v * c).toFixed(3),
                ix: out.length, sprite: id, slot,
                ...(slot === 0 ? { entry: true } : {}),
                ...(ch ? { chain: { id: ch[0], step: ch[1], of: ch[2] } } : {}),
                ...(form ? { form } : {}),
                ...(form === "ranked" ? { ranks: RANKS } : {}),
            } as TreeNode);
            ids[slot] = id;
        }
        if (!pass) { SLOTS.forEach(([, , ls], slot) => ids[slot] && ls.forEach((l) => link(ids[slot], ids[l] ?? ids[0]))); return; }
        OUTER.forEach(([, , ls], k) => ls.forEach((l) => link(ids[SLOTS.length + k], ids[l])));
        byId(ids[8]).excl = ids[9];
        byId(ids[9]).excl = ids[8];
    });
    // junctions: halfway round between two sections, linked to the nearest node on each side
    ARM_ORDER.forEach((arm, ai) => {
        const next = ARM_ORDER[(ai + 1) % ARM_ORDER.length];
        const th = -Math.PI / 2 + ((ai + 0.5) * 2 * Math.PI) / ARM_ORDER.length;
        const [id, name, blurb, flavor, fx] = JUNCTIONS[arm];
        const req = [slotIds[arm][6], slotIds[next][5]];
        out.push({
            id, branch: arm, kind: "notable", name, blurb, flavor, fx, cost: Math.round(JUNCTION_COST * TUNE.treeCost), links: [],
            x: +(7.4 * Math.cos(th)).toFixed(3), y: +(7.4 * Math.sin(th)).toFixed(3), ix: out.length, sprite: id, form: "junction", req,
        });
        req.forEach((r) => link(id, r));
    });
    return out;
}
export const TREE: TreeNode[] = buildTree();
const BY_ID = new Map(TREE.map((n) => [n.id, n]));
export const treeNode = (id: string) => BY_ID.get(id)!;
export const hasNode = (s: State, id: string) => s.tree.includes(id);
/** Buyable once it touches the core or an owned node. A junction needs every node in `req`, not just one. */
export const nodeOpen = (s: State, n: TreeNode) => (n.req ? n.req.every((r) => s.tree.includes(r)) : n.links.some((l) => l === "core" || s.tree.includes(l)));
/** How many ranks of a node are owned: 0 when not owned, 1 for any owned plain node. */
export const nodeLevel = (s: State, id: string) => (s.tree.includes(id) ? (s.treeLv?.[id] ?? 1) : 0);
/** What the next purchase of this node costs (a ranked node climbs by TUNE.rankCost each rank). */
export const nodeCost = (s: State, n: TreeNode) => (n.ranks ? Math.round(n.cost * Math.pow(TUNE.rankCost, nodeLevel(s, n.id))) : n.cost);
/** True when nothing more can be bought on this node. */
export const nodeMaxed = (s: State, n: TreeNode) => nodeLevel(s, n.id) >= (n.ranks ?? 1);
/** AP spent on one node, all its ranks included. */
const nodeSpent = (s: State, n: TreeNode) => { let t = 0; for (let l = 0; l < nodeLevel(s, n.id); l++) t += n.ranks ? Math.round(n.cost * Math.pow(TUNE.rankCost, l)) : n.cost; return t; };
/** AP spent on the whole tree, ranks included (what a respec refunds). */
export const treeSpent = (s: State) => s.tree.reduce((a, id) => a + (BY_ID.has(id) ? nodeSpent(s, BY_ID.get(id)!) : 0), 0);
/** Nodes you can own at once: every node but the other side of each fork. "Whole tree" means this many. */
export const TREE_FULL = TREE.filter((n) => !(n.form === "fork" && n.excl && TREE.indexOf(treeNode(n.excl)) < TREE.indexOf(n))).length;
/** Ids that make a whole tree (the first side of every fork), for admin and tests. */
export const fullTreeIds = () => TREE.filter((n) => !(n.form === "fork" && n.excl && TREE.indexOf(treeNode(n.excl)) < TREE.indexOf(n))).map((n) => n.id);
/** Whole tree: TREE_FULL nodes owned (forks count once). Ranks are not needed. */
export const treeComplete = (s: State) => s.tree.length >= TREE_FULL;
/** Progressive reveal (Nate, 2026-11-12): owned and buyable nodes are shown; one step past a shown node is fog (a
 *  silhouette at its real size, no name or cost); everything further out is hidden. */
/** Admin mode: show every node, fog or not (components/nodefarm/admin.tsx). */
export const adminFlags = { reveal: false };
export function nodeVis(s: State, n: TreeNode): NodeVis {
    if (adminFlags.reveal) return "shown";
    if (s.tree.includes(n.id) || nodeOpen(s, n)) return "shown";
    // a junction shows (locked) once you own either side, so you can see what the other side is for
    if (n.req && n.req.some((r) => s.tree.includes(r))) return "shown";
    return n.links.some((l) => l !== "core" && nodeOpen(s, BY_ID.get(l)!)) ? "fog" : "hidden";
}
/** Buy a node, the next rank of a ranked node, or swap a fork: buying the other side of an owned fork refunds it first. */
export function buyNode(s: State, id: string): boolean {
    const n = BY_ID.get(id);
    if (!n || nodeMaxed(s, n) || !nodeOpen(s, n)) return false;
    const cost = nodeCost(s, n);
    const swap = n.excl && s.tree.includes(n.excl) ? BY_ID.get(n.excl)! : null;
    const back = swap ? nodeSpent(s, swap) : 0;
    if (s.ap + back < cost) return false;
    if (swap) s.tree = s.tree.filter((x) => x !== swap.id); // a new array, so the effect cache recomputes
    s.ap += back - cost;
    if (s.tree.includes(id)) s.treeLv = { ...s.treeLv, [id]: nodeLevel(s, id) + 1 };
    else s.tree = [...s.tree, id];
    return true;
}
/** Take every node back and refund the AP spent on it. Costs nothing. Returns the AP refunded. */
export function respec(s: State): number {
    const back = treeSpent(s);
    s.ap += back;
    s.tree = [];
    s.treeLv = {};
    s.mounts = [];
    // Drone levels that only the removed nodes allowed (extra levels per tier) go with them
    s.drones = s.drones.map((lv) => Math.min(lv, droneMax(s)));
    return back;
}
/** Costs of the 60 nodes from the first big tree (#157), so a save that owns them is refunded in full. */
const LEGACY_COST: Record<string, number> = Object.fromEntries(
    "sg1:6,sg2:10,sg3:10,sg4:20,sg5:32,sg7:13,sg6:60,sg8:25,sg9:31,sg10:36,sg11:63,sgk:98,fg1:6,fg2:12,fg7:6,fg3:16,fg8:14,fg9:17,fg4:28,fg10:24,fg5:44,fg11:39,fg6:68,fgk:91,sy1:6,sy2:10,sy3:12,sy4:24,sy6:48,sy5:28,sy7:28,sy8:22,sy9:28,sy10:34,sy11:56,syk:91,dr1:6,dr2:8,dr3:10,dr4:14,dr5:17,dr6:18,dr7:24,dr8:28,dr9:32,dr10:42,dr11:63,drk:98,an1:7,an2:10,an3:10,an4:15,an5:18,an6:17,an7:28,an8:28,an9:38,an10:39,an11:77,ank:98"
        .split(",").map((p) => [p.split(":")[0], Number(p.split(":")[1])]),
);
/** Batch job (signal arm, slot 1) was removed with the Buy toggle; it cost 10 AP, so an old save gets that back. */
LEGACY_COST.batchjob = 10;
/** Drop node ids that are not in this tree and give their AP back. Returns the AP refunded. */
export function migrateTree(s: State): number {
    let back = 0;
    const keep: string[] = [];
    for (const id of s.tree) {
        if (BY_ID.has(id)) { if (!keep.includes(id)) keep.push(id); }
        else back += LEGACY_COST[id] ?? 0;
    }
    s.tree = keep;
    // ranks only for ranked nodes you own, within their cap
    const lv: Record<string, number> = {};
    for (const [id, v] of Object.entries(s.treeLv ?? {})) { const n = BY_ID.get(id); if (n?.ranks && keep.includes(id) && Number.isFinite(v) && v > 1) lv[id] = Math.min(n.ranks, Math.floor(v)); }
    s.treeLv = lv;
    // both sides of a fork (an admin save, or an old bug): keep the first, refund the second
    for (const id of [...s.tree]) { const n = BY_ID.get(id)!; if (n.excl && s.tree.includes(n.excl) && s.tree.indexOf(n.excl) < s.tree.indexOf(id)) { s.tree = s.tree.filter((x) => x !== id); back += n.cost; } }
    s.ap += back;
    return back;
}
export const hasFeature = (s: State, f: Feature) => s.tree.some((id) => BY_ID.get(id)?.fx.feature === f) || (PREINSTALLED.includes(f) && !!s.hand && handFx(s).preinstall);
/** AP spent on owned nodes and perks. With TUNE.apBonusFromEarned the AP bonus counts this too, so spending never lowers it. */
export function apSpent(s: State): number {
    let n = treeSpent(s);
    for (const p of PERKS) for (let l = 0; l < s.perks[p.id]; l++) n += p.cost(l);
    return n;
}
/** The AP that counts toward the +x% per AP bonus. */
export const apForBonus = (s: State) => s.ap + (TUNE.apBonusFromEarned ? apSpent(s) : 0);
/** What one AP adds to everything right now (0.3 = +30%), Carrier nodes included. */
export const apEach = (s: State) => TUNE.apBonus * (1 + treeFx(s).apEach);
/** The AP part of the global multiplier, optionally with `extra` AP added. */
export const apGlobal = (s: State, extra = 0) => 1 + apSoftened(apForBonus(s) + extra) * apEach(s);
/** AP above TUNE.apSoft counts with diminishing returns. */
export const apSoftened = (ap: number) => (ap <= TUNE.apSoft ? ap : TUNE.apSoft * Math.pow(ap / TUNE.apSoft, TUNE.apSoftPow));

/** What the owned nodes add up to, as label and value rows for the tree menu readout. */
export function treeTotals(s: State): [string, string][] {
    const f = treeFx(s);
    const x = (v: number) => `x${+(1 + v).toFixed(2)}`;
    const rows: [string, string][] = [];
    if (f.global) rows.push(["Everything", x(f.global)]);
    if (f.bytes) rows.push(["Bytes", x(f.bytes)]);
    if (f.reboot) rows.push(["Reboot power", x(f.reboot)]);
    if (f.apEach) rows.push(["Each AP gives", `+${Math.round(apEach(s) * 100)}%`]);
    if (f.ap) rows.push(["AP on Ascend", x(f.ap)]);
    if (f.growth) rows.push(["Price climb", `${Math.round(f.growth * 100)}% slower`]);
    if (f.rebootKeep) rows.push(["Reboot keeps", `${Math.round(f.rebootKeep * 100)}% of Multipliers`]);
    const mats = Object.entries(f.mats).filter(([, v]) => v);
    if (mats.length) rows.push(["Materials boosted", `${mats.length} of ${MATS.length}`]);
    if (f.unlockMul < 1) rows.push(["Materials open at", `${Math.round(f.unlockMul * 100)}%`]);
    if (f.mounts) rows.push(["Mounted drives", String(f.mounts)]);
    if (f.kitReboot) rows.push(["Ascend starts with", `${f.kitReboot} Reboots`]);
    if (Object.keys(f.kitProd).length) rows.push(["Starter producers", Object.keys(f.kitProd).map((m) => statDef(m as MatId).short).join(" ")]);
    if (f.kitDrones) rows.push(["Starter Drones", `level ${f.kitDrones}`]);
    if (f.offline) rows.push(["Offline cap", `+${f.offline} h`]);
    if (f.goals) rows.push(["Each goal gives", `+${Math.round((TUNE.achBonus + f.goals) * 100)}%`]);
    if (f.drone) rows.push(["Drone speed", x(f.drone)]);
    if (f.droneMax) rows.push(["Drone levels", `${TUNE.drone.max + f.droneMax} max`]);
    if (f.droneCost < 1) rows.push(["Drone prices", `-${Math.round((1 - f.droneCost) * 100)}%`]);
    if (f.droneOff) rows.push(["Drones away", `${Math.round(Math.min(1, TUNE.drone.offline + f.droneOff) * 100)}% speed`]);
    if (f.droneKeep) rows.push(["Drones kept", `${Math.round(f.droneKeep * 100)}%`]);
    if (f.droneGlobal) rows.push(["Per Drone level", `+${Math.round(f.droneGlobal * 100)}% everything`]);
    if (f.eventRate) rows.push(["Events", `${Math.round(f.eventRate * 100)}% sooner`]);
    if (f.ocMult || f.ocX) rows.push(["Overclock", `x${+((TUNE.overclockMult + f.ocMult) * (1 + f.ocX)).toFixed(1)}`]);
    if (f.ocTime) rows.push(["Overclock length", x(f.ocTime)]);
    if (f.zeroDay) rows.push(["Zero-day chance", `${Math.round(f.zeroDay * 100)}%`]);
    if (f.echo) rows.push(["Echo chance", `${Math.round(f.echo * 100)}%`]);
    if (f.winBoost) rows.push(["Per event win", `+${Math.round(f.winBoost * 100)}% this run`]);
    if (f.coldStart) rows.push(["After a Reboot", `Bytes x${1 + f.coldStart} for ${TUNE.coldStartSecs} s`]);
    if (f.longHaul) rows.push(["Long haul now", `Bytes x${+runBytes(s, f).toFixed(1)}`]);
    if (f.specialist) rows.push(["Newest material", `x${1 + f.specialist}`]);
    if (f.perNode) rows.push(["Per node owned", `+${Math.round(f.perNode * 100)}% (x${+(1 + f.perNode * treeCount(s)).toFixed(2)} now)`]);
    if (f.spearhead) rows.push(["Top Drone tier", `x${1 + f.spearhead}`]);
    if (f.winPay) rows.push(["Per event win", `${Math.round(f.winPay / 60)} min of output`]);
    if (f.busbar) rows.push(["Bus bar now", `materials x${+(1 + f.busbar * Math.log10(1 + s.reboot)).toFixed(2)}`]);
    if (f.apPerMat) rows.push(["AP per material", `+${Math.round(f.apPerMat * 100)}% each`]);
    if (f.droneTierGoal) rows.push(["Night crew", `+${f.droneTierGoal * tiersDone(s)} Drone levels`]);
    if (f.frenzy) rows.push(["Swarm alarm", `Drones x${TUNE.frenzyX} for ${TUNE.frenzySecs} s per win`]);
    if (f.ocReboot) rows.push(["Overclock Reboot power", `x${1 + f.ocReboot}`]);
    const named: Record<Feature, string> = { watchdog: "Watchdog timer", forecast: "Forecast", deaddrop: "Dead drop", orders: "Standing orders", ghostline: "Ghost line", crosstalk: "Cross-talk", duck: "Rubber duck" };
    if (f.features.length) rows.push(["Systems", f.features.map((k) => named[k]).join(", ")]);
    return rows;
}

const mulIn = (a: number, b?: number) => (b ? (1 + a) * (1 + b) - 1 : a);
/** Everything the owned tree nodes give. Boosts named "x(1 + this)" stack by multiplying. Cached per tree array and length. */
const FX_CACHE = new WeakMap<string[], { n: number; v: ReturnType<typeof treeFxRaw> }>();
export function treeFx(s: State) {
    // ranks change without changing the tree array, so they are part of the key
    let n = s.tree.length;
    if (s.treeLv) for (const k in s.treeLv) n += s.treeLv[k] * 1000;
    const c = FX_CACHE.get(s.tree);
    if (c && c.n === n) return c.v;
    const v = treeFxRaw(s);
    FX_CACHE.set(s.tree, { n, v });
    return v;
}
function treeFxRaw(s: State) {
    const o = {
        bytes: 0, global: 0, reboot: 0, multGain: 0, discount: 1, start: 0, offline: 0, overclock: 0, ocMult: 0, ap: 0, goals: 0, drone: 0, droneMax: 0, droneCost: 1, droneOff: 0,
        mats: {} as Record<string, number>,
        apEach: 0, growth: 0, rebootKeep: 0, unlockMul: 1, kitReboot: 0, kitProd: {} as Record<string, number>, kitDrones: 0, droneKeep: 0, droneGlobal: 0, mounts: 0,
        eventRate: 0, ocTime: 0, ocX: 0, winBoost: 0, zeroDay: 0, echo: 0, features: [] as Feature[],
        coldStart: 0, longHaul: 0, specialist: 0, perNode: 0, spearhead: 0, winPay: 0, busbar: 0, apPerMat: 0, droneTierGoal: 0, frenzy: 0, ocReboot: 0,
    };
    const each: TreeFx[] = [];
    for (const id of s.tree) {
        const f = BY_ID.get(id)?.fx;
        if (!f) continue;
        for (let l = nodeLevel(s, id); l > 0; l--) each.push(f); // a ranked node applies once per rank
    }
    for (const f of each) {
        o.bytes = mulIn(o.bytes, f.bytes);
        o.global = mulIn(o.global, f.global);
        o.reboot = mulIn(o.reboot, f.reboot);
        o.multGain = mulIn(o.multGain, f.multGain);
        o.discount *= 1 - (f.discount ?? 0);
        o.start += f.start ?? 0;
        o.offline += f.offline ?? 0;
        o.overclock += f.overclock ?? 0;
        o.ocMult += f.ocMult ?? 0;
        o.ap = mulIn(o.ap, f.ap);
        o.goals += f.goals ?? 0;
        o.drone = mulIn(o.drone, f.drone);
        o.droneMax += f.droneMax ?? 0;
        o.droneCost *= 1 - (f.droneCost ?? 0);
        o.droneOff += f.droneOff ?? 0;
        for (const [m, v] of Object.entries(f.mats ?? {})) o.mats[m] = mulIn(o.mats[m] ?? 0, v);
        o.apEach += f.apEach ?? 0;
        o.growth = 1 - (1 - o.growth) * (1 - (f.growth ?? 0));
        o.rebootKeep = Math.max(o.rebootKeep, f.rebootKeep ?? 0);
        o.unlockMul *= f.unlockMul ?? 1;
        o.kitReboot += f.kitReboot ?? 0;
        for (const [m, v] of Object.entries(f.kitProd ?? {})) o.kitProd[m] = (o.kitProd[m] ?? 0) + v;
        o.kitDrones = Math.max(o.kitDrones, f.kitDrones ?? 0);
        o.droneKeep = Math.max(o.droneKeep, f.droneKeep ?? 0);
        o.droneGlobal += f.droneGlobal ?? 0;
        o.mounts += f.mounts ?? 0;
        o.eventRate += f.eventRate ?? 0;
        o.ocTime = mulIn(o.ocTime, f.ocTime);
        o.ocX = mulIn(o.ocX, f.ocX);
        o.winBoost += f.winBoost ?? 0;
        o.zeroDay += f.zeroDay ?? 0;
        o.echo += f.echo ?? 0;
        if (f.feature) o.features.push(f.feature);
        o.coldStart += f.coldStart ?? 0;
        o.longHaul += f.longHaul ?? 0;
        o.specialist += f.specialist ?? 0;
        o.perNode += f.perNode ?? 0;
        o.spearhead += f.spearhead ?? 0;
        o.winPay += f.winPay ?? 0;
        o.busbar += f.busbar ?? 0;
        o.apPerMat += f.apPerMat ?? 0;
        o.droneTierGoal += f.droneTierGoal ?? 0;
        o.frenzy += f.frenzy ?? 0;
        o.ocReboot += f.ocReboot ?? 0;
    }
    return o;
}

export interface State {
    v: 1;
    at: number; // last saved/ticked, ms epoch
    started: number;
    bytes: number;
    mult: number;
    reboot: number;
    copper: number;
    silicon: number;
    quartz: number;
    aether: number;
    runes: number;
    starglass: number;
    voidsteel: number;
    chrono: number;
    nebula: number;
    pulsars: number;
    singularity: number;
    engrams: number;
    paradox: number;
    origin: number;
    spores: number;
    mycelium: number;
    pollen: number;
    bloom: number;
    basalt: number;
    magma: number;
    geodes: number;
    sunstone: number;
    prod: Record<MatId, number>;
    bought: Record<ButtonStat, number[]>;
    ap: number;
    perks: Record<PerkDef["id"], number>;
    ach: string[];
    /** when each goal or secret was done, ms epoch (for the goal log) */
    achAt: Record<string, number>;
    /** ids of the story logs recovered so far (lib/nodefarm/story.ts, kept through Ascend) */
    logs: string[];
    /** Drone levels per button tier (reset on Ascend) */
    drones: number[];
    /** fractional presses waiting to fire, per tier */
    droneAcc: number[];
    /** stats the Drones are allowed to press (kept through Ascend) */
    armed: string[];
    /** owned prestige-tree node ids (bought with AP, kept through Ascend) */
    tree: string[];
    /** ranks above 1 of ranked tree nodes, by id (kept through Ascend; an owned ranked node without an entry is rank 1) */
    treeLv?: Record<string, number>;
    /** life.secs at the last Reboot or Ascend (Cold start and Long haul) */
    rebootAt?: number;
    /** seconds of Drone frenzy left (Swarm alarm) */
    frenzy?: number;
    /** materials on Mounted drives: their producers survive Ascend (kept through Ascend) */
    mounts: MatId[];
    /** Watchdog timer switch (auto-Reboot) */
    watchdog: boolean;
    /** when the Dead drop started filling, ms epoch (0 = not yet) */
    dropAt: number;
    /** event wins this run (Spike protocol), reset on Ascend */
    runWins: number;
    /** stats Standing orders has already armed once, so a stat you disarm stays disarmed */
    autoArmed: string[];
    /** AP refunded when an old tree was replaced, shown once in the feed and then cleared */
    treeRefund?: number;
    /** Exploit Lab: Intel, research nodes, compile queue, payload stock and running buffs (see LabState) */
    lab: LabState;
    /** Drone hangar: postings, zone mastery, Parts, mods and the drone tree (see DroneState) */
    dr: DroneState;
    /** Handover (the reset past Ascend): Keys, Firmware, the protocol and your handover notes (see HandState) */
    hand: HandState;
    /** Scripts (lib/nodefarm/scripts.ts): what you taught the scheduler and how each script is set. Kept through Ascend. Created on first use. */
    auto?: AutoState;
    /** Zone rigs (lib/nodefarm/rigs.ts): one machine per zone. Levels kept through Ascend, meters reset. Created on first use. */
    rig?: RigState;
    /** Zone events (lib/nodefarm/zoneevents.ts): the running event, the timer to the next one and a count. Reset on Ascend. Created on first use. */
    ze?: ZoneEvState;
    /** Which button tiers were ever pressed, per stat, as a bit mask. Kept through Ascend; arcs clear when every tier of every zone in them is set. */
    seen?: Partial<Record<ButtonStat, number>>;
    // lifetime counters (survive Ascend)
    life: { bytes: number; taps: number; reboots: number; ascends: number; intrusions: number; secs: number; presses: number; capped: number; peakBps: number; apTotal: number; intel: number; compiled: number; deployed: number };
    overclock: number; // seconds left
}

/** Scripts: learned automation (rules live in lib/nodefarm/scripts.ts, which registers itself in TICK_HOOKS). */
export type ScriptId = "buy" | "reboot" | "compile" | "deploy" | "drop" | "ascend" | "rig" | "event" | "restore";
export interface AutoState {
    /** manual presses per stat and tier, lifetime (buy.sh may only press tiers you pressed by hand) */
    taught: Record<string, number[]>;
    /** manual actions counted toward learning each script */
    learn: Partial<Record<ScriptId, number>>;
    /** learned scripts */
    own: ScriptId[];
    /** running switches (reboot.sh uses the Watchdog switch, `watchdog`) */
    on: Partial<Record<ScriptId, boolean>>;
    /** buy.sh: bitmask of the tiers it may press, per stat */
    buy: Record<string, number>;
    /** buy.sh: only buys while the balance is at least this many times the price */
    keep: number;
    /** reboot.sh: Reboots once Multipliers reach this many times the best price */
    rebootX: number;
    /** compile.sh: keep each recipe stocked up to this many */
    stockTo: Partial<Record<PayloadId, number>>;
    /** deploy.sh: payloads it deploys */
    dep: PayloadId[];
    /** ascend.sh: Ascends once the AP on offer is this many times the last Ascend's */
    ascX: number;
    /** AP the last Ascend paid, and life.secs when it happened (ascend.sh) */
    lastAp: number;
    runAt: number;
    /** ascends and apTotal seen, to notice an Ascend from anywhere */
    seenAsc: number;
    seenAp: number;
    /** cycle timers and actions run per script (buy.sh's version comes from its total) */
    acc: Partial<Record<ScriptId, number>>;
    ran: Partial<Record<ScriptId, number>>;
    /** buttons pressed by scripts, so the feed can tell them from Drone presses */
    presses: number;
    // second batch (optional, so first-batch saves load as they are)
    /** reboot.sh: wait for a full Capacitor (zone 03 rig); deploy a stocked Logic bomb first */
    capWait?: boolean;
    bombFirst?: boolean;
    /** ascend.sh: deploy a stocked Zero-click first */
    zeroFirst?: boolean;
    /** rig.sh: zones whose rig it upgrades, and the reserve it keeps (times the price) */
    rigs?: Record<string, boolean>;
    rigX?: number;
    /** event.sh: how it answers a Rich vein and a Fault */
    vein?: "mine" | "run";
    fault?: "patch" | "wait";
    /** restore.sh: the build saved before the last Handover (tree order, ranks, perks), whether it is rebuilding, and what it rebuilds */
    build?: string[];
    buildLv?: Record<string, number>;
    buildPerks?: Record<string, number>;
    rebuild?: boolean;
    seenHand?: number;
    restPerks?: boolean;
}
/** Called at the end of every tick (and so also through time away). Scripts add themselves here. */
export const TICK_HOOKS: ((s: State, dt: number) => void)[] = [];

/** Zone rigs: one machine per zone (rules in lib/nodefarm/rigs.ts, which fills RIG_HOOKS when it is imported).
 *  Levels and settings are kept through Ascend; meters, charges and timers belong to the run. */
export interface RigState {
    /** rig levels by key (a zone id, or "runes:echo" style keys for the Glyph hall's three carvings) */
    lv: Record<string, number>;
    /** Root chamber rewrites: extra level cap per zone */
    re: Record<string, number>;
    /** rewrites done in total (prices the next) */
    rw: number;
    // settings (kept)
    scrub: boolean;
    aim: string;
    draw: number;
    rwAim: string;
    /** 22 Bedrock shaft: coolant on the drill bit (optional, old saves have none) */
    cool?: boolean;
    /** 21 Bloom core: seeds banked at each Ascend (kept through Ascend) */
    seeds?: number;
    // run meters (reset on Ascend)
    cache: number;
    quiet: number;
    pour: number;
    casts: number;
    dust: number;
    grow: number;
    glow: number;
    glowLeft: number;
    wx: number;
    pulse: number;
    pulses: number;
    fired: number;
    well: number;
    /** 20 Canopy hall day clock, 22 drill bit wear (0..1), 23 Magma line pressure clock and seconds of shaft heat left */
    sun?: number;
    wear?: number;
    vent?: number;
    heat?: number;
}
/** Filled by lib/nodefarm/rigs.ts. Every hook is optional, so the engine (and the sim) run the same without rigs. */
export const RIG_HOOKS: {
    /** per-zone output multipliers, computed once per derive */
    muls?: (s: State) => Partial<Record<StatId, number>>;
    /** the Reboots a Reboot press pays, after the rig's say */
    reboot?: (s: State, gain: number) => number;
    /** right after a Reboot has wiped Bytes */
    afterReboot?: (s: State) => void;
    /** after any non-Reboot button press */
    spend?: (s: State, stat: ButtonStat, tier: number) => void;
    /** every tick, with the tick's derived numbers */
    step?: (s: State, dt: number, d: Derived) => void;
    /** the rig state the new run starts with (called before Ascend wipes the run) */
    ascend?: (s: State) => RigState | undefined;
} = {};
// ---- Zone events: the numbers and the two reads the rest of the engine needs (spawning and choices live in lib/nodefarm/zoneevents.ts)
export type ZoneEvKind = "surge" | "clearance" | "resonance" | "vein" | "fault";
export interface ZoneEvActive {
    /** a running number, so the screen can tell a new event from the one it already showed */
    id: number;
    kind: ZoneEvKind;
    zone: StatId;
    /** seconds left, and the length it started with */
    left: number;
    total: number;
    /** vein and fault: you have answered the choice (Let it run, Wait it out), so the buttons go away. Mining and patching end the event instead. */
    picked?: boolean;
}
export interface ZoneEvState {
    act: ZoneEvActive[];
    /** game seconds until the next event may start */
    wait: number;
    /** events seen, and how many of each kind (for the feed and Records) */
    seen: number;
    kinds: Partial<Record<ZoneEvKind, number>>;
    /** the zone of the last event, so the next one lands somewhere else */
    last?: StatId;
}
export const ZE_TUNE = {
    /** gap between events in game seconds, [min, max]; the first one waits for `first` seconds of life */
    gap: [480, 840] as [number, number],
    first: 480,
    /** how long each lasts, seconds */
    secs: { surge: 180, clearance: 180, resonance: 180, vein: 240, fault: 180 } as Record<ZoneEvKind, number>,
    /** relative odds of each kind */
    odds: { surge: 3, clearance: 2, resonance: 2, vein: 2, fault: 1 } as Record<ZoneEvKind, number>,
    /** output multipliers */
    surge: 2,
    resonance: 1.6,
    vein: 2,
    fault: 0.5,
    /** Clearance: price multiplier on that zone's buttons */
    clearance: 0.6,
    /** Rich vein: seconds of the zone's output paid at once if you Mine it */
    mine: 240,
    /** Fault: seconds of Bytes output a Patch costs */
    patch: 25,
    /** no Fault before this much life */
    faultFrom: 900,
};
/** The zone a Resonance also lifts: the one below it in the chain (Bytes pairs with Multipliers). */
export const resonancePair = (zone: StatId): StatId => { const i = STATS.findIndex((x) => x.id === zone); return STATS[i > 0 ? i - 1 : 1].id; };
/** Output multiplier an event puts on a zone (1 when none). Bytes: Bytes per second. Multipliers: button strength. Reboots: Reboot strength. Materials: their rate. */
export function zeOut(s: State, id: StatId): number {
    const a = s.ze?.act;
    if (!a || !a.length) return 1;
    let x = 1;
    for (const e of a) {
        if (e.left <= 0) continue;
        if (e.kind === "surge" && e.zone === id) x *= ZE_TUNE.surge;
        else if (e.kind === "vein" && e.zone === id) x *= ZE_TUNE.vein;
        else if (e.kind === "fault" && e.zone === id) x *= ZE_TUNE.fault;
        else if (e.kind === "resonance" && (e.zone === id || resonancePair(e.zone) === id)) x *= ZE_TUNE.resonance;
    }
    return x;
}
/** Price multiplier on a zone's buttons (Clearance). */
export function zeCost(s: State, stat: StatId): number {
    const a = s.ze?.act;
    if (!a || !a.length) return 1;
    let x = 1;
    for (const e of a) if (e.kind === "clearance" && e.zone === stat && e.left > 0) x *= ZE_TUNE.clearance;
    return x;
}

export function fresh(now = Date.now()): State {
    return {
        v: 1,
        at: now,
        started: now,
        bytes: 0,
        mult: 1,
        reboot: 0,
        copper: 0,
        silicon: 0,
        quartz: 0,
        aether: 0,
        runes: 0,
        starglass: 0,
        voidsteel: 0,
        chrono: 0,
        nebula: 0,
        pulsars: 0,
        singularity: 0,
        engrams: 0,
        paradox: 0,
        origin: 0,
        spores: 0,
        mycelium: 0,
        pollen: 0,
        bloom: 0,
        basalt: 0,
        magma: 0,
        geodes: 0,
        sunstone: 0,
        prod: Object.fromEntries(MATS.map((m) => [m, 0])) as Record<MatId, number>,
        bought: Object.fromEntries((["mult", "reboot", ...MATS] as ButtonStat[]).map((k) => [k, Array(TIERS).fill(0)])) as Record<ButtonStat, number[]>,
        ap: 0,
        perks: { scanner: 0, auto: 0, overclock: 0, offline: 0, start: 0, power: 0 },
        ach: [],
        achAt: {},
        logs: [],
        drones: Array(TIERS).fill(0),
        droneAcc: Array(TIERS).fill(0),
        armed: [],
        tree: [],
        treeLv: {},
        rebootAt: 0,
        frenzy: 0,
        mounts: [],
        watchdog: true,
        dropAt: 0,
        runWins: 0,
        autoArmed: [],
        life: { bytes: 0, taps: 0, reboots: 0, ascends: 0, intrusions: 0, secs: 0, presses: 0, capped: 0, peakBps: 0, apTotal: 0, intel: 0, compiled: 0, deployed: 0 },
        lab: freshLab(),
        dr: freshDr(),
        hand: freshHand(),
        overclock: 0,
    };
}

/** Like boost, but past `cap` the amount only counts by its log10, so a boost on everything cannot feed the material that makes it. */
const boostCapped = (amount: number, k: number, cap: number) => {
    const a = Math.max(0, amount);
    if (a <= cap) return 1 + k * Math.pow(a, TUNE.boostPow);
    return 1 + k * Math.pow(cap, TUNE.boostPow) * (1 + Math.log10(a / cap));
};
const boost = (amount: number, k: number) => 1 + k * Math.pow(Math.max(0, amount), TUNE.boostPow);

export interface Derived {
    global: number;
    bytesPerSec: number;
    rebootStrength: number;
    multGainMult: number;
    rates: Record<MatId, number>;
    offlineCap: number; // seconds
    boosts: { cuReboot: number; cuBytes: number; siCu: number; qzSi: number; aeQz: number; ruAe: number; sgRu: number; vsSg: number; chVs: number; chAll: number; nbCh: number; puNb: number; snPu: number; egSn: number; pxEg: number; orPx: number; spOr: number; mySp: number; poMy: number; blPo: number; baBl: number; mgBa: number; geMg: number; suGe: number };
}

export function derive(s: State): Derived {
    const k = TUNE.boostK;
    const boosts = {
        cuReboot: boost(s.copper, k.cuReboot),
        cuBytes: boost(s.copper, k.cuBytes),
        siCu: boost(s.silicon, k.siCu),
        qzSi: boost(s.quartz, k.qzSi),
        aeQz: boost(s.aether, k.aeQz),
        ruAe: boost(s.runes, k.ruAe),
        sgRu: boost(s.starglass, k.sgRu),
        vsSg: boost(s.voidsteel, k.vsSg),
        chVs: boost(s.chrono, k.chVs),
        chAll: boostCapped(s.chrono, k.chAll, TUNE.chAllCap),
        nbCh: boost(s.nebula, k.nbCh),
        puNb: boost(s.pulsars, k.puNb),
        snPu: boost(s.singularity, k.snPu),
        egSn: boost(s.engrams, k.egSn),
        pxEg: boost(s.paradox, k.pxEg),
        orPx: boost(s.origin, k.orPx),
        spOr: boost(s.spores, k.spOr),
        mySp: boost(s.mycelium, k.mySp),
        poMy: boost(s.pollen, k.poMy),
        blPo: boost(s.bloom, k.blPo),
        baBl: boost(s.basalt, k.baBl),
        mgBa: boost(s.magma, k.mgBa),
        geMg: boost(s.geodes, k.geMg),
        suGe: boost(s.sunstone, k.suGe),
    };
    const tf = treeFx(s);
    const lb = labBuffs(s);
    const droneLv = s.drones.reduce((a, b) => a + b, 0);
    const global = (1 + s.perks.power * 0.15) * (1 + tf.global) * apGlobal(s) * (1 + s.ach.length * (TUNE.achBonus + tf.goals) * (1 + protoK(s, "tamsin"))) * (1 + tiersDone(s) * TUNE.tierBonus) * handGlobal(s) * (ARC_HOOKS.cleared ? 1 + TUNE.arcBonus * ARC_HOOKS.cleared(s) : 1)
        * (1 + droneLv * tf.droneGlobal) * (1 + s.runWins * tf.winBoost) * boosts.chAll * singularityAll(s) * (s.overclock > 0 ? overclockMult(s) : 1) * lb.global
        * (tf.perNode ? 1 + tf.perNode * treeCount(s) : 1) * foundryAll(s) * sunstoneAll(s);
    const wren = protoK(s, "wren");
    const rig = RIG_HOOKS.muls ? RIG_HOOKS.muls(s) : {};
    const rebootStrength = TUNE.rebootStrength * boosts.cuReboot * (1 + tf.reboot) * (tf.ocReboot && s.overclock > 0 ? 1 + tf.ocReboot : 1) * (1 + wren) * zeOut(s, "reboot");
    const multGainMult = (1 + rebootStrength * s.reboot) * (1 + tf.multGain) * lb.mult * masteryMul(s, "mult") * (1 + 2 * wren) * zeOut(s, "mult") * (rig.mult ?? 1);
    // capped like every amount, so a runaway late game can never write Infinity (null in JSON) into the save
    const bytesPerSec = Math.min(CAP, s.mult * boosts.cuBytes * global * (1 + tf.bytes) * lb.bytes * runBytes(s, tf) * zeOut(s, "bytes") * (rig.bytes ?? 1));
    // each material is boosted by the one after it in the chain
    const boostedBy: Record<MatId, number> = { copper: boosts.siCu, silicon: boosts.qzSi, quartz: boosts.aeQz, aether: boosts.ruAe, runes: boosts.sgRu, starglass: boosts.vsSg, voidsteel: boosts.chVs, chrono: boosts.nbCh, nebula: boosts.puNb, pulsars: boosts.snPu, singularity: boosts.egSn, engrams: boosts.pxEg, paradox: boosts.orPx, origin: boosts.spOr, spores: boosts.mySp, mycelium: boosts.poMy, pollen: boosts.blPo, bloom: boosts.baBl, basalt: boosts.mgBa, magma: boosts.geMg, geodes: boosts.suGe, sunstone: 1 };
    // Cross-talk: each material is also boosted by the one two steps up the chain. Log-scaled: a power-law boost here made a second
    // feedback loop through all fourteen materials and the sim hit Infinity within minutes of buying it (balance audit 2026-11-12).
    if (tf.features.includes("crosstalk")) MATS.forEach((m, i) => { const up = MATS[i + 2]; if (up) boostedBy[m] *= logBoost(s[up], TUNE.logK.crosstalk); });
    // Bus bar (Reboots feed every material) and Specialist (the newest material you produce)
    const bus = tf.busbar ? 1 + tf.busbar * Math.log10(1 + s.reboot) : 1;
    let newest: MatId | null = null;
    if (tf.specialist) for (const m of MATS) if (s.prod[m] > 0) newest = m;
    const rates = {} as Record<MatId, number>;
    for (const m of MATS) rates[m] = Math.min(CAP, s.prod[m] * TUNE.perProducer[m] * boostedBy[m] * (1 + (tf.mats[m] ?? 0)) * global * (FORGE_MATS.includes(m) ? lb.forge : 1) * bus * (m === newest ? 1 + tf.specialist : 1) * masteryMul(s, m) * zeOut(s, m) * (rig[m] ?? 1));
    return { global, bytesPerSec, rebootStrength, multGainMult, rates, offlineCap: Math.max(1, TUNE.offlineCapHours + s.perks.offline * 4 + tf.offline + (handFx(s).standby ? HAND_TUNE.standbyHours : 0)) * 3600, boosts };
}

/** Nodes plus extra ranks owned (Investor). */
export const treeCount = (s: State) => { let n = s.tree.length; if (s.treeLv) for (const k in s.treeLv) n += Math.max(0, s.treeLv[k] - 1); return n; };
/** Seconds since the last Reboot or Ascend. */
export const sinceReboot = (s: State) => Math.max(0, s.life.secs - (s.rebootAt ?? 0));
/** The Bytes multiplier from Cold start or Long haul, which depend on time since the last Reboot. */
export function runBytes(s: State, tf = treeFx(s)): number {
    let x = 1;
    const t = sinceReboot(s);
    if (tf.coldStart && t < TUNE.coldStartSecs) x *= 1 + tf.coldStart;
    if (tf.longHaul) x *= 1 + Math.min(TUNE.longHaulMax, t / 60 / TUNE.longHaulMins) * tf.longHaul;
    return x;
}

export const gainFor = (stat: ButtonStat, tier: number) => TUNE.gainBase[stat] * Math.pow(TUNE.gainRatio, tier);

/** What pressing one button costs and gives right now. */
export function button(s: State, stat: ButtonStat, tier: number) {
    if (stat === "reboot") {
        const tf = treeFx(s);
        const cost = TUNE.rebootBase * Math.pow(TUNE.rebootRatio, tier) * Math.pow(TUNE.rebootGrowth, s.reboot * (1 - tf.growth)) * tf.discount * zeCost(s, "reboot");
        return { cost, gain: Math.max(1, Math.round(Math.pow(TUNE.rebootGainRatio, tier))), pays: "mult" as StatId };
    }
    const c = TUNE.cost[stat];
    const tf = treeFx(s);
    const cost = c.base * Math.pow(c.ratio, tier) * Math.pow(c.growth, s.bought[stat][tier] * (1 - tf.growth)) * tf.discount * zeCost(s, stat);
    let gain = gainFor(stat, tier);
    if (stat === "mult") gain *= derive(s).multGainMult;
    return { cost, gain, pays: statDef(stat).pays as StatId };
}

export const amount = (s: State, id: StatId) => s[id] as number;
export const canAfford = (s: State, stat: ButtonStat, tier: number) => {
    const b = button(s, stat, tier);
    return amount(s, b.pays) >= b.cost;
};

/** Reboots decrypt after this many Bytes earned in total, or this many Multipliers held. */
export const REBOOT_UNLOCK = { bytes: 600, mult: 40 };

export function isUnlocked(s: State, id: StatId): boolean {
    if (id === "bytes" || id === "mult") return true;
    if (id === "reboot") return s.life.bytes >= REBOOT_UNLOCK.bytes || s.reboot > 0 || s.mult >= REBOOT_UNLOCK.mult;
    if (id === "copper") return s.life.reboots >= TUNE.unlockAt.copper;
    if (ARC_MATS.includes(id as MatId) && !(s.hand?.count > 0)) return false;
    const i = MATS.indexOf(id as MatId);
    const below = MATS[i - 1];
    // after your first Ascend a stat opens at a quarter of the usual amount
    const need = unlockNeed(s, id);
    return s.prod[id as MatId] > 0 || amount(s, below) >= need || (s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper && amount(s, below) >= need / 4);
}

/** Press a button. Returns false when it can't be afforded. A Reboot press also resets Bytes and Multipliers. */
export function press(s: State, stat: ButtonStat, tier: number): boolean {
    const b = button(s, stat, tier);
    if (amount(s, b.pays) < b.cost) return false;
    (s.seen ??= {})[stat] = ((s.seen[stat] ?? 0) | (1 << tier));
    if (stat === "reboot") {
        // Logic bomb (Exploit Lab): an armed charge multiplies this Reboot
        const bomb = s.lab.armed.indexOf("logicbomb");
        let gain = bomb >= 0 ? Math.round(b.gain * (1 + payloadV(s, payload("logicbomb")))) : b.gain;
        if (RIG_HOOKS.reboot) gain = RIG_HOOKS.reboot(s, gain);
        if (bomb >= 0) s.lab.armed.splice(bomb, 1);
        // a crash dump: the Reboot banks the Intel buffer (it refills over LAB_TUNE.dumpSecs)
        labLump(s, s.lab.dump);
        s.lab.dump = 0;
        s.reboot += gain;
        s.life.presses += 1;
        s.life.reboots += gain;
        s.rebootAt = s.life.secs;
        s.mult = Math.max(1, s.mult * treeFx(s).rebootKeep);
        s.bought.mult.fill(0);
        s.bytes = derive(s).bytesPerSec * (10 * s.perks.start + treeFx(s).start);
        RIG_HOOKS.afterReboot?.(s);
        return true;
    }
    (s[b.pays] as number) = amount(s, b.pays) - b.cost;
    s.life.presses += 1;
    s.bought[stat][tier] += 1;
    if (stat === "mult") s.mult += b.gain;
    else s.prod[stat] += b.gain;
    RIG_HOOKS.spend?.(s, stat, tier);
    return true;
}

export const droneMax = (s: State) => { const f = treeFx(s); return TUNE.drone.max + f.droneMax + droneFx(s).droneMax + (f.droneTierGoal ? f.droneTierGoal * tiersDone(s) : 0); };
export const droneCost = (s: State, tier: number) => TUNE.drone.base * Math.pow(TUNE.drone.ratio, tier) * Math.pow(TUNE.drone.growth, s.drones[tier]) * treeFx(s).droneCost * (1 - droneFx(s).droneCost) / (1 + protoK(s, "osk"));
export const dronesOpen = (s: State) => s.aether > 0 || s.prod.aether > 0 || s.life.ascends > 0;
export function buyDrone(s: State, tier: number): boolean {
    const c = droneCost(s, tier);
    if (!dronesOpen(s) || s.drones[tier] >= droneMax(s) || s.aether < c) return false;
    s.aether -= c;
    s.drones[tier] += 1;
    return true;
}
/** Singularity pulls on everything, Engrams make Drones press faster, Paradox makes Overclock stronger, Origin adds AP. Log-scale so none of them can run away. */
const logBoost = (amount: number, k: number) => 1 + k * Math.log10(1 + Math.max(0, amount));
export const singularityAll = (s: State) => logBoost(s.singularity, TUNE.logK.snAll);
export const droneBoost = (s: State) => logBoost(s.engrams, TUNE.logK.egDrone);
export const paradoxOc = (s: State) => logBoost(s.paradox, TUNE.logK.pxOc);
export const originAp = (s: State) => logBoost(s.origin, TUNE.logK.orAp);
/** Bloom: every Handover pays more Keys. Sunstone: everything a little. Both log-scaled like the Origin arc extras. */
export const bloomKeys = (s: State) => logBoost(s.bloom, TUNE.logK.blKeys);
export const sunstoneAll = (s: State) => logBoost(s.sunstone, TUNE.logK.suAll);
/** The highest Drone tier with a level, or -1. */
const topDrone = (s: State) => { for (let k = s.drones.length - 1; k >= 0; k--) if (s.drones[k] > 0) return k; return -1; };
export const droneRate = (s: State, tier: number) => {
    const f = treeFx(s);
    let r = s.drones[tier] * TUNE.drone.rate * (1 + f.drone) * labBuffs(s).drone * droneBoost(s) * hangarSpeed(s, tier) * (1 + 2 * protoK(s, "osk"));
    if (f.spearhead && r > 0 && topDrone(s) === tier) r *= 1 + f.spearhead; // Spearhead: the top tier you own
    if (f.frenzy && (s.frenzy ?? 0) > 0) r *= TUNE.frenzyX; // Swarm alarm
    return r;
};
export function toggleArm(s: State, stat: string) {
    s.armed = s.armed.includes(stat) ? s.armed.filter((x) => x !== stat) : [...s.armed, stat];
}
/** Let the Drones press for dt seconds. eff scales their speed (time away runs slower). Returns presses made.
 * A Drone with no posting sweeps: it presses its tier on every armed zone. A posted Drone presses only its zone, DRONE_TUNE.postX
 * times as fast, and its work there builds that zone's mastery. Reach mods also press the tier below. Every press a Drone
 * attempts salvages a little Parts. */
export function droneStep(s: State, dt: number, eff = 1): number {
    const D = s.dr;
    const fx = droneFx(s);
    const sweep = s.armed.filter((st) => st !== "bytes" && st !== "reboot" && isUnlocked(s, st as StatId)) as ButtonStat[];
    let made = 0;
    let units = 0;
    const pressN = (st: ButtonStat, tier: number, n: number) => { for (let i = 0; i < n; i++) { if (!press(s, st, tier)) break; made++; } };
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        const base = droneRate(s, k) * dt * eff;
        const post = postOf(s, k);
        const sweepRate = post ? (fx.garrison ? base : 0) : base * (1 + fx.sweep);
        const postRate = post ? base * postX(s, k) : 0;
        const reach = (D.mods[k]?.[2] ?? 0) * DRONE_TUNE.reachEach;
        // sweeping
        if (sweepRate > 0 && sweep.length) {
            s.droneAcc[k] = Math.min(s.droneAcc[k] + sweepRate, TUNE.drone.burst);
            const n = Math.floor(s.droneAcc[k]);
            if (n >= 1) { s.droneAcc[k] -= n; for (const st of sweep) pressN(st, k, n); }
            units += sweepRate * sweep.length;
            if (fx.sweepSvc) for (const st of sweep) addSvc(s, st, sweepRate * fx.sweepSvc, fx);
        }
        // posted
        if (post) {
            D.pacc[k] = Math.min(D.pacc[k] + postRate, TUNE.drone.burst * 4);
            const n = Math.floor(D.pacc[k]);
            if (n >= 1) { D.pacc[k] -= n; pressN(post, k, n); }
            units += postRate;
            addSvc(s, post, postRate, fx);
        }
        // reach: the tier below, on the same zones
        if (reach > 0 && k > 0) {
            const zones = [...(post ? [post] : []), ...(sweepRate > 0 ? sweep : [])];
            if (zones.length) {
                D.racc[k] = Math.min(D.racc[k] + (post ? postRate : sweepRate) * reach, TUNE.drone.burst);
                const n = Math.floor(D.racc[k]);
                if (n >= 1) { D.racc[k] -= n; for (const st of zones) pressN(st, k - 1, n); }
            }
        }
    }
    if (units > 0) D.parts = Math.min(CAP, D.parts + units * DRONE_TUNE.partK * (1 + fx.parts));
    return made;
}

/** Ceiling for every amount (doubles overflow to Infinity just past 1.8e308). */
export const CAP = 1e300;

export function tick(s: State, dt: number, eff = 1) {
    const d = derive(s);
    s.bytes += d.bytesPerSec * dt;
    s.life.bytes += d.bytesPerSec * dt;
    // amounts stop at CAP so a very long post-tree run can never reach Infinity and break the save
    for (const m of MATS) s[m] = Math.min(CAP, s[m] + d.rates[m] * dt);
    if (s.bytes > CAP) s.bytes = CAP;
    if (s.life.bytes > CAP) s.life.bytes = CAP;
    if (s.overclock > 0) s.overclock = Math.max(0, s.overclock - dt);
    if (s.frenzy) s.frenzy = Math.max(0, s.frenzy - dt);
    s.life.secs += dt;
    if (d.bytesPerSec > s.life.peakBps) s.life.peakBps = d.bytesPerSec;
    labStep(s, dt, d.bytesPerSec);
    RIG_HOOKS.step?.(s, dt, d);
    droneStep(s, dt, eff);
    watchdogStep(s);
    autoArm(s);
    for (const h of TICK_HOOKS) h(s, dt);
}

export const overclockMult = (s: State) => { const f = treeFx(s); return (TUNE.overclockMult + f.ocMult) * (1 + f.ocX) * paradoxOc(s); };
export const overclockSecs = (s: State) => { const f = treeFx(s); return Math.max(5, (TUNE.overclockSecs + s.perks.overclock * 5 + f.overclock) * (1 + f.ocTime)); };

/** Production for `secs` seconds at the current rate (Bytes and every material), paid at once. Used by the Dead drop and Zero-day. */
export function payout(s: State, secs: number, only?: readonly MatId[]) {
    const d = derive(s);
    const oc = s.overclock > 0 ? overclockMult(s) : 1; // a lump is never paid at Overclock rate
    const gain: Partial<Record<StatId, number>> = { bytes: (d.bytesPerSec / oc) * secs };
    s.bytes += gain.bytes!;
    s.life.bytes += gain.bytes!;
    for (const m of only ?? MATS) { const v = (d.rates[m] / oc) * secs; if (v > 0) { s[m] += v; gain[m] = v; } }
    return gain;
}

/** Win a quick-time event: a timed Overclock, plus whatever the Anomaly nodes add. `rnd` is injectable for tests.
 *  Returns what happened so the UI can say it. */
export function breach(s: State, rnd: () => number = Math.random) {
    const f = treeFx(s);
    const stacked = f.features.includes("ghostline") && s.overclock > 0;
    s.overclock = stacked ? s.overclock + overclockSecs(s) : overclockSecs(s);
    s.life.intrusions += 1;
    s.runWins += 1;
    const zero = f.zeroDay > 0 && rnd() < f.zeroDay ? payout(s, TUNE.zeroDayPays) : null;
    const echo = f.echo > 0 && rnd() < f.echo;
    const intel = labLump(s, LAB_TUNE.eventSecs);
    const listen = protoK(s, "vael") * HAND_TUNE.vaelPay; // Vael's protocol: every win pays a little production
    const paid = f.winPay + listen > 0 ? payout(s, f.winPay + listen) : null; // Patient
    const frenzy = f.frenzy > 0;
    if (frenzy) s.frenzy = TUNE.frenzySecs; // Swarm alarm
    return { stacked, zero, echo, intel, paid, frenzy };
}
/** How much sooner events come (Wide-band scanner perk plus Static), as a fraction off the gap. */
export const eventHaste = (s: State) => 1 - Math.max(0.3, (1 - s.perks.scanner * 0.08) * (1 - treeFx(s).eventRate)) / (1 + protoK(s, "vael"));

// ---- Watchdog timer (auto-Reboot) and the Dead drop
/** Press the best affordable Reboot once you hold TUNE.watchdogReserve times its price. Returns the tier pressed, or -1. */
export function watchdogStep(s: State): number {
    // once reboot.sh is learned it runs the rule itself (lib/nodefarm/scripts.ts, with the Capacitor and Logic bomb options)
    if (s.auto?.own.includes("reboot")) return -1;
    if (!s.watchdog || !hasFeature(s, "watchdog") || !isUnlocked(s, "reboot")) return -1;
    const x = TUNE.watchdogReserve;
    for (let k = TIERS - 1; k >= 0; k--) {
        const b = button(s, "reboot", k);
        if (s.mult >= b.cost * x) {
            if (!press(s, "reboot", k)) return -1;
            if (s.auto) s.auto.ran.reboot = (s.auto.ran.reboot ?? 0) + 1;
            return k;
        }
    }
    return -1;
}
/** 0..1 how full the Dead drop is. Starts filling the moment the node is owned. */
export function dropFill(s: State, now = Date.now()): number {
    if (!hasFeature(s, "deaddrop")) return 0;
    if (!s.dropAt) s.dropAt = now;
    return Math.min(1, Math.max(0, (now - s.dropAt) / (TUNE.dropHours * 3600 * 1000)));
}
export function openDrop(s: State, now = Date.now()) {
    if (dropFill(s, now) < 1) return null;
    s.dropAt = now;
    return payout(s, TUNE.dropPays);
}
/** Standing orders: arm each stat once, the first time it is open. */
export function autoArm(s: State): string[] {
    if (!hasFeature(s, "orders")) return [];
    const out: string[] = [];
    for (const st of STATS) {
        if (st.id === "bytes" || st.id === "reboot" || s.autoArmed.includes(st.id) || !isUnlocked(s, st.id)) continue;
        s.autoArmed.push(st.id);
        if (!s.armed.includes(st.id)) { s.armed.push(st.id); out.push(st.id); }
    }
    return out;
}
/** Material slots on Mounted drives. */
export const mountSlots = (s: State) => treeFx(s).mounts;
export function setMount(s: State, slot: number, mat: MatId | null) {
    const max = mountSlots(s);
    if (slot < 0 || slot >= max) return false;
    const next = s.mounts.filter((m) => m !== mat).slice(0, max);
    if (mat) next[slot] = mat; else next.splice(slot, 1);
    s.mounts = next.filter(Boolean).slice(0, max);
    return true;
}

export const apOnAscend = (s: State) => {
    if (s.aether < ascendNeed(s)) return 0;
    let raw = Math.pow(s.aether / TUNE.apPerAether, TUNE.apPow);
    for (const [m, per] of Object.entries(TUNE.apPer)) raw += Math.pow(s[m as MatId] / per, TUNE.apPow);
    const tf = treeFx(s);
    let gain = raw * (1 + tf.ap) * originAp(s) * (s.lab.armed.includes("zeroclick") ? 1 + payload("zeroclick").v : 1) * (tf.apPerMat ? 1 + tf.apPerMat * MATS.filter((m) => s.prod[m] > 0).length : 1) * handAp(s);
    if (TUNE.apGainSoft > 0 && gain > TUNE.apGainSoft) gain = TUNE.apGainSoft * (1 + Math.log(gain / TUNE.apGainSoft));
    return Math.floor(gain);
};
export const canAscend = (s: State) => apOnAscend(s) >= 1;

export function ascend(s: State) {
    const gain = apOnAscend(s);
    if (gain < 1) return 0;
    const tf = treeFx(s);
    const mounts = s.mounts.slice(0, tf.mounts);
    const keptProd = Object.fromEntries(mounts.map((m) => [m, Math.floor(s.prod[m] * TUNE.mountKeep)]));
    const keptDrones = s.drones.map((lv) => Math.max(Math.floor(lv * tf.droneKeep), tf.kitDrones));
    const oldDrones = s.drones.slice();
    const hf = handFx(s);
    // Lab image (Firmware) keeps Intel and running payloads through Ascend
    const lab: LabState = { ...s.lab, intel: hf.labKeep ? s.lab.intel : 0, run: hf.labKeep ? s.lab.run : [], armed: s.lab.armed.filter((x) => x !== "zeroclick"), dump: LAB_TUNE.dumpSecs };
    const hand: HandState = { ...s.hand, cycleAp: s.hand.cycleAp + gain };
    const dr = drOnAscend(s);
    const rig = RIG_HOOKS.ascend ? RIG_HOOKS.ascend(s) : s.rig;
    const keep = { lab, dr, hand, rig, seen: s.seen, ap: s.ap + gain, perks: s.perks, ach: s.ach, achAt: s.achAt, logs: s.logs, tree: s.tree, treeLv: s.treeLv, armed: s.armed, mounts: s.mounts, watchdog: s.watchdog, dropAt: s.dropAt, autoArmed: s.autoArmed, auto: s.auto, life: { ...s.life, ascends: s.life.ascends + 1, apTotal: s.life.apTotal + gain }, started: s.started };
    const n = fresh(s.at);
    Object.assign(n, keep);
    Object.assign(s, n);
    // starting kits and what the tree carries over
    s.reboot = tf.kitReboot;
    s.rebootAt = s.life.secs;
    for (const [m, v] of Object.entries(tf.kitProd)) s.prod[m as MatId] += v;
    for (const [m, v] of Object.entries(keptProd)) s.prod[m as MatId] = Math.max(s.prod[m as MatId], v);
    s.drones = keptDrones.map((lv, k) => Math.max(lv, Math.floor(oldDrones[k] * hf.droneKeep))); // Drone RAM (Firmware)
    bootKit(s);
    if (s.ze) s.ze.act = []; // a running zone event ends with the run (its count and timer stay)
    return gain;
}

export function buyPerk(s: State, id: PerkDef["id"]): boolean {
    const p = PERKS.find((x) => x.id === id)!;
    const lvl = s.perks[id];
    if (lvl >= p.max || s.ap < p.cost(lvl)) return false;
    s.ap -= p.cost(lvl);
    s.perks[id] += 1;
    return true;
}

/** Catch up for time away. Production only; nothing is bought for you (except by the scripts you taught). Returns what was gained.
 *  The steps are short (10 s) while scripts are running, and a step never runs past the moment a timed boost ends (Overclock,
 *  Swarm alarm, a zone event, a deployed payload), so a boost counts for exactly the time it had left, not a whole step. */
export function offline(s: State, seconds: number) {
    const cap = derive(s).offlineCap;
    const secs = Math.min(Math.max(0, seconds), cap);
    const before = Object.fromEntries((["bytes", ...MATS] as const).map((k) => [k, s[k]])) as Record<"bytes" | MatId, number>;
    const per = s.auto?.own.length ? 10 : 20;
    const steps = Math.min(2400, Math.max(1, Math.ceil(secs / per)));
    const dt = secs / steps;
    const oc = s.overclock;
    s.overclock = 0; // an intrusion boost doesn't carry through time away
    const pressesBefore = s.life.presses;
    const eff = handFx(s).standby ? 1 : Math.min(1, TUNE.drone.offline + treeFx(s).droneOff + droneFx(s).off);
    const nextEnd = () => {
        let m = Infinity;
        if (s.overclock > 0) m = Math.min(m, s.overclock);
        if (s.frenzy) m = Math.min(m, s.frenzy);
        for (const e of s.ze?.act ?? []) if (e.left > 0) m = Math.min(m, e.left);
        for (const r of s.lab.run) if (r.left > 0) m = Math.min(m, r.left);
        return m;
    };
    for (let i = 0; i < steps; i++) {
        let left = dt;
        for (let guard = 0; left > 1e-9 && guard < 40; guard++) {
            const h = guard === 39 ? left : Math.min(left, Math.max(0.05, nextEnd()));
            tick(s, h, eff);
            left -= h;
        }
    }
    s.overclock = Math.max(0, oc - secs);
    return { secs, capped: seconds > cap, drones: s.life.presses - pressesBefore, gain: Object.fromEntries((["bytes", ...MATS] as const).map((k) => [k, s[k] - before[k]])) as Record<"bytes" | MatId, number> };
}

// ---- goals. Five tiers of six. Each goal gives a small permanent boost (TUNE.achBonus) and a full tier gives a bigger one (TUNE.tierBonus).
export interface Goal {
    id: string;
    name: string;
    hint: string;
    tier: number; // 1..GOAL_TIERS
    icon: StatId | "alert" | "ascend" | "spark" | "lock";
    cur: (s: State) => number;
    target: number;
}
export const GOAL_TIERS = 12;
export const TIER_NAMES = ["", "Access", "Operator", "Admin", "Root", "Kernel", "Deep", "Zero", "Source", "Bedrock", "Daemon", "Subsystem", "Firmware"];
const G = (id: string, name: string, hint: string, tier: number, icon: Goal["icon"], target: number, cur: (s: State) => number): Goal => ({ id, name, hint, tier, icon, cur, target });
const life = (k: keyof State["life"]) => (s: State) => s.life[k];
export const GOALS: Goal[] = [
    // I  ACCESS
    G("tap10", "First contact", "Press 10 buttons.", 1, "spark", 10, life("presses")),
    G("b1k", "Packet storm", "Earn 1,000 Bytes.", 1, "bytes", 1e3, life("bytes")),
    G("m100", "Stacked", "Hold 100 Multipliers.", 1, "mult", 100, (s) => s.mult),
    G("r1", "Cold boot", "Reboot once.", 1, "reboot", 1, life("reboots")),
    G("cu1", "Trace lines", "Mine your first Copper.", 1, "copper", 1e-9, (s) => s.copper),
    G("int1", "Counter-hack", "Win a quick-time event.", 1, "alert", 1, life("intrusions")),
    // II OPERATOR
    G("tap500", "Calloused", "Press 500 buttons.", 2, "spark", 500, life("presses")),
    G("b1m", "Bandwidth", "Earn 1 million Bytes.", 2, "bytes", 1e6, life("bytes")),
    G("m10k", "Overstacked", "Hold 10,000 Multipliers.", 2, "mult", 1e4, (s) => s.mult),
    G("r25", "Habit", "Reach 25 Reboots.", 2, "reboot", 25, life("reboots")),
    G("cu1k", "Spool", "Hold 1,000 Copper.", 2, "copper", 1e3, (s) => s.copper),
    G("si1", "Wafer thin", "Mine your first Silicon.", 2, "silicon", 1e-9, (s) => s.silicon),
    // III ADMIN
    G("tap5k", "Keycap fatigue", "Press 5,000 buttons.", 3, "spark", 5000, life("presses")),
    G("b1b", "Backbone", "Earn 1 billion Bytes.", 3, "bytes", 1e9, life("bytes")),
    G("r100", "Triple digits", "Reach 100 Reboots.", 3, "reboot", 100, life("reboots")),
    G("si1k", "Fab line", "Hold 1,000 Silicon.", 3, "silicon", 1e3, (s) => s.silicon),
    G("qz1", "Resonance", "Mine your first Quartz.", 3, "quartz", 1e-9, (s) => s.quartz),
    G("int25", "Watchdog", "Win 25 quick-time events.", 3, "alert", 25, life("intrusions")),
    // IV ROOT
    G("p25k", "Muscle memory", "Press 25,000 buttons.", 4, "spark", 25000, life("presses")),
    G("b1t", "Whole network", "Earn 1 trillion Bytes.", 4, "bytes", 1e12, life("bytes")),
    G("r500", "Uptime is a myth", "Reach 500 Reboots.", 4, "reboot", 500, life("reboots")),
    G("qz1k", "Clean cut", "Hold 1,000 Quartz.", 4, "quartz", 1e3, (s) => s.quartz),
    G("ae1", "Signal in the noise", "Gather your first Aether.", 4, "aether", 1e-9, (s) => s.aether),
    G("asc1", "Ascended", "Ascend once.", 4, "ascend", 1, life("ascends")),
    // V  KERNEL
    G("b1qa", "Past the index", "Earn 1 quadrillion Bytes.", 5, "bytes", 1e15, life("bytes")),
    G("cu1m", "Mother lode", "Hold 1 million Copper.", 5, "copper", 1e6, (s) => s.copper),
    G("si1m", "Silicon valley", "Hold 1 million Silicon.", 5, "silicon", 1e6, (s) => s.silicon),
    G("ae1k", "Open channel", "Hold 1,000 Aether.", 5, "aether", 1e3, (s) => s.aether),
    G("ae10k", "Beyond the veil", "Hold 10,000 Aether.", 5, "aether", 1e4, (s) => s.aether),
    G("asc5", "Fifth floor", "Ascend 5 times.", 5, "ascend", 5, life("ascends")),
    // VI DEEP: the materials past Aether, and the prestige tree
    G("ru1", "Carved", "Gather your first Runes.", 6, "runes", 1e-9, (s) => s.runes),
    G("sg1", "Starlight", "Gather your first Starglass.", 6, "starglass", 1e-9, (s) => s.starglass),
    G("vs1", "Cold metal", "Gather your first Voidsteel.", 6, "voidsteel", 1e-9, (s) => s.voidsteel),
    G("ch1", "Borrowed time", "Gather your first Chrono.", 6, "chrono", 1e-9, (s) => s.chrono),
    G("tr1", "Branching", "Buy a node in the prestige tree.", 6, "ascend", 1, (s) => s.tree.length),
    G("ap10", "Tenfold", "Earn 10 Ascension Points in total.", 6, "ascend", 10, life("apTotal")),
    // VII ZERO
    G("b1qi", "Astronomical", "Earn 1 quintillion Bytes.", 7, "bytes", 1e18, life("bytes")),
    G("p100k", "Stuck key", "Press 100,000 buttons.", 7, "spark", 100000, life("presses")),
    G("r2k", "Reboot loop", "Reach 2,500 Reboots.", 7, "reboot", 2500, life("reboots")),
    G("ch1k", "Spare hours", "Hold 1,000 Chrono.", 7, "chrono", 1e3, (s) => s.chrono),
    G("asc20", "Habit of leaving", "Ascend 20 times.", 7, "ascend", 20, life("ascends")),
    G("tr18", "Whole tree", "Own every node in the prestige tree (one side of each fork).", 7, "ascend", TREE_FULL, (s) => s.tree.length),
    // VIII SOURCE: the six zones past Chrono, out into space and then down to where the node began
    G("nb1", "Stardust", "Gather your first Nebula.", 8, "nebula", 1e-9, (s) => s.nebula),
    G("pu1", "Lighthouse keeper", "Catch your first Pulsar.", 8, "pulsars", 1e-9, (s) => s.pulsars),
    G("sn1", "Point of no return", "Reach the first Singularity.", 8, "singularity", 1e-9, (s) => s.singularity),
    G("eg1", "Deja vu", "Record your first Engram.", 8, "engrams", 1e-9, (s) => s.engrams),
    G("px1", "Both at once", "Fold your first Paradox.", 8, "paradox", 1e-9, (s) => s.paradox),
    G("or1", "Node zero", "Reach the first Origin.", 8, "origin", 1e-9, (s) => s.origin),
    // IX BEDROCK: the two arcs past Root Chamber, up through the farm (Overgrowth) and then down to the buried sun (Descent)
    G("sp1", "Damp", "Grow your first Spores.", 9, "spores", 1e-9, (s) => s.spores),
    G("my1", "Wired in", "Spin your first Mycelium.", 9, "mycelium", 1e-9, (s) => s.mycelium),
    G("po1", "Daylight", "Gather your first Pollen.", 9, "pollen", 1e-9, (s) => s.pollen),
    G("bl1", "In flower", "Open your first Bloom.", 9, "bloom", 1e-9, (s) => s.bloom),
    G("ba1", "Hard floor", "Cut your first Basalt.", 9, "basalt", 1e-9, (s) => s.basalt),
    G("mg1", "Running hot", "Tap your first Magma.", 9, "magma", 1e-9, (s) => s.magma),
    G("ge1", "Hollow", "Crack your first Geode.", 9, "geodes", 1e-9, (s) => s.geodes),
    G("su1", "The bottom", "Reach the buried sun.", 9, "sunstone", 1e-9, (s) => s.sunstone),
];

// ---- secrets. They show as ???? until found, with a clue. Console ones are unlocked by commands (components/cm/console.tsx -> lib/nodefarm/records.ts);
// the rest are checked here by `test`. Found secrets count toward the goal bonus like any goal.
export interface Secret {
    id: string;
    name: string;
    clue: string;
    /** shown once found */
    how: string;
    test?: (s: State) => boolean;
}
export const SECRETS: Secret[] = [
    { id: "x_loop", name: "Loopback", clue: "Ask the console to ping home.", how: "Ran `nf ping 127.0.0.1` in the console." },
    { id: "x_sudo", name: "Not in the sudoers file", clue: "Try to take control from the console.", how: "Ran `nf sudo` in the console." },
    { id: "x_self", name: "Self aware", clue: "Ask the node who it is.", how: "Ran `nf whoami` in the console." },
    { id: "x_night", name: "Night shift", clue: "The farm runs at all hours. So do you.", how: "Had Node Farm open between 3 and 4 in the morning.", test: () => new Date().getHours() === 3 },
    { id: "x_haul", name: "Long haul", clue: "Stay a very long time.", how: "Played for 24 hours in total.", test: (s) => s.life.secs >= 86400 },
    { id: "x_duck", name: "Quack", clue: "Some of the best help is cheap and very quiet.", how: "Bought the Rubber duck in the prestige tree.", test: (s) => s.tree.includes("duck") },
    { id: "x_fork", name: "Fork bomb", clue: "Ask the console to copy itself until the machine gives up.", how: "Ran `nf fork` in the console." },
    { id: "x_tank", name: "Full tank", clue: "Leave it alone until the standby cells are full.", how: "Came back to a full standby report.", test: (s) => s.life.capped >= 1 },
];
export const secretDone = (s: State, x: Secret) => s.ach.includes(x.id);
/** Record a goal or secret as done. False if it already was. */
export function unlock(s: State, id: string): boolean {
    if (s.ach.includes(id)) return false;
    s.ach.push(id);
    s.achAt[id] = Date.now();
    return true;
}

export const goalDone = (s: State, g: Goal) => s.ach.includes(g.id);
/** Number of fully completed tiers. */
export function tiersDone(s: State): number {
    let n = 0;
    for (let t = 1; t <= GOAL_TIERS; t++) if (GOALS.filter((g) => g.tier === t).every((g) => s.ach.includes(g.id))) n++;
    return n;
}

/** Returns goals newly completed (and records them). */
export function checkGoals(s: State): { id: string; name: string; secret?: boolean }[] {
    const out: { id: string; name: string; secret?: boolean }[] = [];
    for (const g of GOALS) if (!s.ach.includes(g.id) && g.cur(s) >= g.target && unlock(s, g.id)) out.push(g);
    for (const x of SECRETS) if (x.test && !s.ach.includes(x.id) && x.test(s) && unlock(s, x.id)) out.push({ id: x.id, name: x.name, secret: true });
    return out;
}

/** Autoloader perk: each level unlocks auto-buying for one stat. Buys at most one button per stat per call. */
export function autoBuy(s: State): number {
    const order: ButtonStat[] = ["mult", ...MATS];
    let n = 0;
    for (let i = 0; i < Math.min(order.length, s.perks.auto); i++) {
        const st = order[i];
        if (!isUnlocked(s, st)) continue;
        if (s.auto?.on.buy && s.auto.buy[st]) continue; // buy.sh has this stat: its rules win
        for (let k = TIERS - 1; k >= 0; k--) {
            const b = button(s, st, k);
            if (amount(s, b.pays) >= b.cost * TUNE.autoReserve) {
                if (press(s, st, k)) n++;
                break;
            }
        }
    }
    return n;
}

// ---- Exploit Lab (research). Intel runs alongside Bytes: a trickle that grows with the log of Bytes/s, plus lumps from
// Reboots (crash dumps) and quick-time event wins. Intel buys nodes in a small research tree (kept through Ascend); most
// nodes unlock a recipe. Recipes compile (a short timer, in a queue, also while away) into payloads you stock and deploy:
// timed buffs, one-shot charges and instant effects. Opens with Silicon. See docs/node-farm.md "Exploit Lab".
export type LabSec = "exploits" | "malware" | "infra";
export type PayloadId = "sniffer" | "worm" | "logicbomb" | "ransom" | "kernel" | "rootkit" | "trojan" | "botnet" | "zeroclick" | "polymorph";
export type PayloadKind = "buff" | "charge" | "instant";
export interface PayloadDef {
    id: PayloadId;
    sec: LabSec;
    name: string;
    kind: PayloadKind;
    /** what it does, one plain line */
    blurb: string;
    /** short HUD tag while it runs or is armed */
    tag: string;
    /** seconds to compile */
    compile: number;
    /** seconds a buff runs */
    dur: number;
    /** strength: buffs multiply by (1 + v) */
    v: number;
    /** the Intel part of the price: this many seconds of the base Intel trickle (Fiber tap and Root shell not counted), at least 10 */
    intel: number;
    /** the material part of the price: `secs` of its current output, at least `floor` */
    mat: { stat: StatId; secs: number; floor: number };
}
export const LAB_TUNE = {
    intelK: 0.006, // Intel per second = intelK * log10(1 + Bytes/s)^intelPow
    intelPow: 2,
    dumpSecs: 25, // a Reboot banks up to this many seconds of Intel (crash dump), refilling as time passes
    eventSecs: 90, // an event win banks this many seconds of Intel
    queue: 3, // compile queue length
    slots: 2, // buffs running at once
    stockMax: 5, // stock per payload
    maxRun: 3600, // a buff's time left never goes past this
    nodeCost: [80, 600, 600, 5000, 5000, 30000], // Intel per slot
    labScale: 1, // scales every research node price (pacing knob)
    opensAt: "silicon" as StatId,
};
export const LAB_SECS: { id: LabSec; name: string; blurb: string; color: string }[] = [
    { id: "exploits", name: "Exploits", blurb: "Payloads for Bytes, Multipliers and Reboots.", color: "#59b8ff" },
    { id: "malware", name: "Malware", blurb: "Payloads for materials, Drones, events and Ascend.", color: "#8f9bff" },
    { id: "infra", name: "Infra", blurb: "The lab itself: Intel, compile speed, slots.", color: "#5ff0e8" },
];
const P = (id: PayloadId, sec: LabSec, name: string, kind: PayloadKind, blurb: string, tag: string, compile: number, dur: number, v: number, intel: number, mat: PayloadDef["mat"]): PayloadDef => ({ id, sec, name, kind, blurb, tag, compile, dur, v, intel, mat });
export const PAYLOADS: PayloadDef[] = [
    P("sniffer", "exploits", "Packet sniffer", "buff", "Bytes x2 for 10 minutes.", "SNIFF", 300, 600, 1, 180, { stat: "bytes", secs: 180, floor: 1e4 }),
    P("worm", "exploits", "Worm", "buff", "Multiplier buttons add x2 for 10 minutes.", "WORM", 300, 600, 1, 240, { stat: "copper", secs: 180, floor: 50 }),
    P("logicbomb", "exploits", "Logic bomb", "charge", "Arms your next Reboot: it gives x3 Reboots.", "BOMB", 480, 0, 2, 200, { stat: "copper", secs: 240, floor: 80 }),
    P("ransom", "exploits", "Ransomware", "instant", "Pays out 10 minutes of Bytes, Copper, Silicon and Quartz at once.", "", 1800, 0, 600, 400, { stat: "silicon", secs: 240, floor: 60 }),
    P("kernel", "exploits", "Kernel exploit", "buff", "Everything x2 for 5 minutes.", "KERNEL", 900, 300, 1, 900, { stat: "quartz", secs: 300, floor: 200 }),
    P("rootkit", "malware", "Rootkit", "buff", "Copper, Silicon and Quartz x1.75 for 15 minutes.", "ROOTKIT", 900, 900, 0.75, 240, { stat: "silicon", secs: 180, floor: 30 }),
    P("trojan", "malware", "Trojan", "instant", "Starts an Overclock right now, as if you won an event.", "", 900, 0, 0, 150, { stat: "copper", secs: 120, floor: 40 }),
    P("botnet", "malware", "Botnet", "buff", "Drones press twice as fast for 10 minutes.", "BOTNET", 300, 600, 1, 300, { stat: "aether", secs: 240, floor: 5 }),
    P("zeroclick", "malware", "Zero-click", "charge", "Arms your next Ascend: it pays x1.25 AP.", "0-CLICK", 1800, 0, 0.25, 1200, { stat: "runes", secs: 300, floor: 10 }),
    P("polymorph", "malware", "Polymorph", "instant", "Doubles the time left on every running payload.", "", 900, 0, 1, 600, { stat: "aether", secs: 300, floor: 20 }),
];
const PAY_BY = new Map(PAYLOADS.map((p) => [p.id, p]));
export const payload = (id: PayloadId) => PAY_BY.get(id)!;

export interface LabFx {
    recipe?: PayloadId;
    intel?: number; // Intel x(1 + this)
    compile?: number; // compiles x(1 + this) as fast
    queue?: number; // extra queue places
    slots?: number; // extra buff slots
    potency?: LabSec; // that section's buffs are 50% stronger
    longer?: LabSec; // that section's buffs last twice as long
    dumps?: number; // Reboot and event Intel x(1 + this)
    cron?: boolean; // an empty queue repeats the last compile
}
export interface LabNode {
    id: string;
    branch: LabSec;
    kind: TreeKind;
    name: string;
    blurb: string;
    flavor: string;
    cost: number;
    links: string[];
    fx: LabFx;
    x: number;
    y: number;
    ix: number;
    sprite: string;
    entry?: boolean;
}
// Each section is a small diamond: entry, two paths of two, keystone. 0 entry | 1, 3 upper | 2, 4 lower | 5 keystone.
const LAB_SLOTS: [number, number, number[]][] = [[2.3, 0, []], [3.9, -1.1, [0]], [3.9, 1.1, [0]], [5.7, -1.25, [1]], [5.7, 1.25, [2]], [7.5, 0, [3, 4]]];
type LabRow = [slot: number, id: string, kind: TreeKind, name: string, blurb: string, flavor: string, fx: LabFx];
const LAB_ARMS: Record<LabSec, LabRow[]> = {
    exploits: [
        [0, "rx_sniffer", "minor", "Packet sniffer", "Payload: Packet sniffer. Bytes x2 for 10 minutes.", "Listen first. The wire tells you everything if you let it talk.", { recipe: "sniffer" }],
        [1, "rx_worm", "minor", "Worm", "Payload: Worm. Multiplier buttons add x2 for 10 minutes.", "It copies itself into every amp on the stack. The amps don't mind.", { recipe: "worm" }],
        [2, "rx_logicbomb", "minor", "Logic bomb", "Payload: Logic bomb. Your next Reboot gives x3 Reboots.", "Set it, forget it, and let the next restart do the work.", { recipe: "logicbomb" }],
        [3, "rx_obfuscate", "notable", "Obfuscation", "Exploits buffs are 50% stronger.", "Same code, uglier. Nothing on the line recognises it anymore.", { potency: "exploits" }],
        [4, "rx_ransom", "minor", "Ransomware", "Payload: Ransomware. Pays out 10 minutes of Bytes, Copper, Silicon and Quartz at once.", "Lock it, then charge the node for its own key. The node always pays.", { recipe: "ransom" }],
        [5, "rx_kernel", "keystone", "Kernel exploit", "Payload: Kernel exploit. Everything x2 for 5 minutes.", "Ring zero. For five minutes nothing on this node says no.", { recipe: "kernel" }],
    ],
    malware: [
        [0, "rx_rootkit", "minor", "Rootkit", "Payload: Rootkit. Copper, Silicon and Quartz x1.75 for 15 minutes.", "Dig in under the forge. It runs hotter when it can't see you.", { recipe: "rootkit" }],
        [1, "rx_trojan", "minor", "Trojan", "Payload: Trojan. Starts an Overclock right now.", "Looks like a gift. Is a gift, mostly.", { recipe: "trojan" }],
        [2, "rx_botnet", "minor", "Botnet", "Payload: Botnet. Drones press twice as fast for 10 minutes.", "Lent the Drones a few thousand extra hands. Nobody asked whose.", { recipe: "botnet" }],
        [3, "rx_mutate", "notable", "Mutation", "Malware buffs last twice as long.", "Every copy a little different. The scanner gave up counting.", { longer: "malware" }],
        [4, "rx_zeroclick", "minor", "Zero-click", "Payload: Zero-click. Your next Ascend pays x1.25 AP.", "No prompt, no warning, more points on the way up.", { recipe: "zeroclick" }],
        [5, "rx_polymorph", "keystone", "Polymorph", "Payload: Polymorph. Doubles the time left on every running payload.", "It wears whatever is already running and makes it last.", { recipe: "polymorph" }],
    ],
    infra: [
        [0, "rx_tap", "minor", "Fiber tap", "Intel x2.", "Spliced a second line into the trunk. Twice the gossip.", { intel: 1 }],
        [1, "rx_flags", "minor", "Compiler flags", "Compiles run twice as fast, and the queue holds 5.", "-O3 and a prayer.", { compile: 1, queue: 2 }],
        [2, "rx_crashlog", "minor", "Crash collector", "Reboots and event wins give x3 Intel.", "Every crash leaves a dump. Every dump has a secret in it.", { dumps: 2 }],
        [3, "rx_socket", "notable", "Second socket", "Run one more buff at once (3).", "Another socket on the bench. Two hands were never enough.", { slots: 1 }],
        [4, "rx_cron", "notable", "Cron job", "When the queue empties, it compiles your last recipe again if you can pay.", "Every minute, on the minute, the same small job. It never forgets.", { cron: true }],
        [5, "rx_rootshell", "keystone", "Root shell", "Intel x3 and one more buff slot (4).", "Prompt ends in a hash now. The whole lab answers to it.", { intel: 2, slots: 1 }],
    ],
};
const LAB_ORDER: LabSec[] = ["exploits", "malware", "infra"];
function buildLab(): LabNode[] {
    const out: LabNode[] = [];
    LAB_ORDER.forEach((arm, ai) => {
        const th = -Math.PI / 2 + (ai * 2 * Math.PI) / LAB_ORDER.length;
        const c = Math.cos(th), sn = Math.sin(th);
        const ids: string[] = [];
        for (const [slot, id, kind, name, blurb, flavor, fx] of LAB_ARMS[arm]) {
            const [u, v] = LAB_SLOTS[slot];
            out.push({
                id, branch: arm, kind, name, blurb, flavor, fx,
                cost: Math.round(LAB_TUNE.nodeCost[slot] * (kind === "notable" ? 1.3 : 1) * LAB_TUNE.labScale),
                links: slot === 0 ? ["core"] : [],
                x: +(u * c - v * sn).toFixed(3), y: +(u * sn + v * c).toFixed(3),
                ix: out.length, sprite: id,
                ...(slot === 0 ? { entry: true } : {}),
            });
            ids[slot] = id;
        }
        LAB_SLOTS.forEach(([, , ls], slot) => ls.forEach((l) => {
            const A = out.find((n) => n.id === ids[slot])!, B = out.find((n) => n.id === ids[l])!;
            A.links.push(B.id);
            B.links.push(A.id);
        }));
    });
    return out;
}
export const LAB: LabNode[] = buildLab();
const LAB_BY = new Map(LAB.map((n) => [n.id, n]));
export const labNode = (id: string) => LAB_BY.get(id)!;
export const labHas = (s: State, id: string) => s.lab.nodes.includes(id);
export const labNodeOpen = (s: State, n: LabNode) => n.links.some((l) => l === "core" || s.lab.nodes.includes(l));
export function labVis(s: State, n: LabNode): NodeVis {
    if (s.lab.nodes.includes(n.id) || labNodeOpen(s, n)) return "shown";
    return n.links.some((l) => l !== "core" && labNodeOpen(s, LAB_BY.get(l)!)) ? "fog" : "hidden";
}
/** The lab is open once Silicon has been reached in any run (it stays open after Ascend). */
export const labOpen = (s: State) => s.lab.seen;

export interface LabState {
    seen: boolean;
    intel: number;
    nodes: string[];
    queue: { id: PayloadId; left: number }[];
    stock: Partial<Record<PayloadId, number>>;
    run: { id: PayloadId; left: number }[];
    armed: PayloadId[];
    last: PayloadId | null;
    /** seconds of crash-dump Intel banked and ready for the next Reboot */
    dump: number;
}
export const freshLab = (): LabState => ({ seen: false, intel: 0, nodes: [], queue: [], stock: {}, run: [], armed: [], last: null, dump: LAB_TUNE.dumpSecs });

const LFX_CACHE = new WeakMap<string[], { n: number; v: ReturnType<typeof labFxRaw> }>();
export function labFx(s: State) {
    const c = LFX_CACHE.get(s.lab.nodes);
    if (c && c.n === s.lab.nodes.length) return c.v;
    const v = labFxRaw(s);
    LFX_CACHE.set(s.lab.nodes, { n: s.lab.nodes.length, v });
    return v;
}
function labFxRaw(s: State) {
    const o = { recipes: [] as PayloadId[], intel: 0, compile: 0, queue: 0, slots: 0, potency: [] as LabSec[], longer: [] as LabSec[], dumps: 0, cron: false };
    for (const id of s.lab.nodes) {
        const f = LAB_BY.get(id)?.fx;
        if (!f) continue;
        if (f.recipe) o.recipes.push(f.recipe);
        o.intel = mulIn(o.intel, f.intel);
        o.compile = mulIn(o.compile, f.compile);
        o.queue += f.queue ?? 0;
        o.slots += f.slots ?? 0;
        if (f.potency) o.potency.push(f.potency);
        if (f.longer) o.longer.push(f.longer);
        o.dumps += f.dumps ?? 0;
        if (f.cron) o.cron = true;
    }
    return o;
}
export const labQueueMax = (s: State) => LAB_TUNE.queue + labFx(s).queue;
export const labSlots = (s: State) => LAB_TUNE.slots + labFx(s).slots;
export const hasRecipe = (s: State, id: PayloadId) => labFx(s).recipes.includes(id);
/** A buff's strength right now (Obfuscation makes Exploits buffs 50% stronger). */
export const payloadV = (s: State, p: PayloadDef) => p.v * (labFx(s).potency.includes(p.sec) ? 1.5 : 1);
export const payloadDur = (s: State, p: PayloadDef) => p.dur * (labFx(s).longer.includes(p.sec) ? 2 : 1);
export const compileSecs = (s: State, p: PayloadDef) => p.compile / (1 + labFx(s).compile);
/** Intel per second right now. Uses the log of Bytes/s so it stays steady from one era to the next. */
export function intelRate(s: State, bytesPerSec = derive(s).bytesPerSec): number {
    if (!s.lab.seen) return 0;
    return LAB_TUNE.intelK * Math.pow(Math.log10(1 + Math.max(0, bytesPerSec)), LAB_TUNE.intelPow) * (1 + labFx(s).intel) * (1 + 2 * protoK(s, "tamsin"));
}
/** What compiling one payload costs right now. */
export function payloadCost(s: State, p: PayloadDef, d: Derived = derive(s)) {
    const rate = p.mat.stat === "bytes" ? d.bytesPerSec : (d.rates as Record<string, number>)[p.mat.stat] ?? 0;
    const base = intelRate(s, d.bytesPerSec) / (1 + labFx(s).intel) / (1 + 2 * protoK(s, "tamsin"));
    return { intel: Math.max(10, Math.round(base * p.intel)), mat: p.mat.stat, amount: Math.max(p.mat.floor, rate * p.mat.secs) };
}
/** The materials Rootkit and Ransomware work on. Aether and the deep ones are left alone: Aether gates Ascend, and paying it out halved the whole game in the sim. */
export const FORGE_MATS: readonly MatId[] = ["copper", "silicon", "quartz"];
/** Buff multipliers from running payloads, for derive. */
export function labBuffs(s: State) {
    const o = { bytes: 1, mult: 1, forge: 1, global: 1, drone: 1 };
    for (const r of s.lab.run) {
        const p = PAY_BY.get(r.id);
        if (!p || r.left <= 0) continue;
        const x = 1 + payloadV(s, p);
        if (p.id === "sniffer") o.bytes *= x;
        else if (p.id === "worm") o.mult *= x;
        else if (p.id === "kernel") o.global *= x;
        else if (p.id === "rootkit") o.forge *= x;
        else if (p.id === "botnet") o.drone *= x;
    }
    return o;
}
export const isRunning = (s: State, id: PayloadId) => s.lab.run.some((r) => r.id === id && r.left > 0);
export const isArmed = (s: State, id: PayloadId) => s.lab.armed.includes(id);

export function buyLabNode(s: State, id: string): boolean {
    const n = LAB_BY.get(id);
    if (!n || s.lab.nodes.includes(id) || !labNodeOpen(s, n) || s.lab.intel < n.cost) return false;
    s.lab.intel -= n.cost;
    s.lab.nodes.push(id);
    return true;
}
export type CompileFail = "recipe" | "queue" | "stock" | "intel" | "mat";
/** Why a compile can't start right now, or null if it can. */
export function compileBlock(s: State, id: PayloadId, d?: Derived): CompileFail | null {
    const p = PAY_BY.get(id);
    if (!p || !hasRecipe(s, id)) return "recipe";
    if (s.lab.queue.length >= labQueueMax(s)) return "queue";
    if ((s.lab.stock[id] ?? 0) + s.lab.queue.filter((q) => q.id === id).length >= LAB_TUNE.stockMax) return "stock";
    const c = payloadCost(s, p, d);
    if (s.lab.intel < c.intel) return "intel";
    if (amount(s, c.mat) < c.amount) return "mat";
    return null;
}
export function compile(s: State, id: PayloadId): boolean {
    if (compileBlock(s, id)) return false;
    const p = PAY_BY.get(id)!;
    const c = payloadCost(s, p);
    s.lab.intel -= c.intel;
    (s[c.mat] as number) = amount(s, c.mat) - c.amount;
    s.lab.queue.push({ id, left: compileSecs(s, p) });
    s.lab.last = id;
    return true;
}
/** Take the newest queued compile back out and refund it in full. */
export function cancelCompile(s: State, i: number): boolean {
    const q = s.lab.queue[i];
    if (!q) return false;
    const p = PAY_BY.get(q.id)!;
    const c = payloadCost(s, p);
    s.lab.intel += c.intel;
    (s[c.mat] as number) = amount(s, c.mat) + c.amount;
    s.lab.queue.splice(i, 1);
    return true;
}
export type DeployFail = "stock" | "slots" | "armed";
export function deployBlock(s: State, id: PayloadId): DeployFail | null {
    const p = PAY_BY.get(id);
    if (!p || (s.lab.stock[id] ?? 0) < 1) return "stock";
    if (p.kind === "charge" && s.lab.armed.includes(id)) return "armed";
    if (p.kind === "buff" && !isRunning(s, id) && s.lab.run.filter((r) => r.left > 0).length >= labSlots(s)) return "slots";
    return null;
}
/** Deploy one payload from stock. A buff that is already running gets its full time added on (up to an hour). */
export function deploy(s: State, id: PayloadId): { ok: boolean; paid?: Partial<Record<StatId, number>>; stacked?: boolean } {
    if (deployBlock(s, id)) return { ok: false };
    const p = PAY_BY.get(id)!;
    s.lab.stock[id] = (s.lab.stock[id] ?? 0) - 1;
    s.life.deployed += 1;
    if (p.kind === "buff") {
        const r = s.lab.run.find((x) => x.id === id && x.left > 0);
        if (r) { r.left = Math.min(LAB_TUNE.maxRun, r.left + payloadDur(s, p)); return { ok: true, stacked: true }; }
        s.lab.run = s.lab.run.filter((x) => x.left > 0);
        s.lab.run.push({ id, left: payloadDur(s, p) });
        return { ok: true };
    }
    if (p.kind === "charge") { s.lab.armed.push(id); return { ok: true }; }
    if (id === "ransom") return { ok: true, paid: payout(s, p.v, FORGE_MATS) };
    if (id === "trojan") { s.overclock = Math.max(s.overclock, overclockSecs(s)); return { ok: true }; }
    if (id === "polymorph") { for (const r of s.lab.run) if (r.left > 0) r.left = Math.min(LAB_TUNE.maxRun, r.left * 2); return { ok: true }; }
    return { ok: true };
}
/** What the owned research nodes add up to, as label and value rows for the research tree readout. */
export function labTotals(s: State): [string, string][] {
    const f = labFx(s);
    const rows: [string, string][] = [];
    rows.push(["Recipes", `${f.recipes.length} of ${PAYLOADS.length}`]);
    if (f.intel) rows.push(["Intel", `x${+(1 + f.intel).toFixed(2)}`]);
    if (f.compile) rows.push(["Compile speed", `x${+(1 + f.compile).toFixed(2)}`]);
    rows.push(["Queue", `${labQueueMax(s)} places`]);
    rows.push(["Buffs at once", String(labSlots(s))]);
    if (f.dumps) rows.push(["Dump Intel", `x${1 + f.dumps}`]);
    for (const sec of f.potency) rows.push([`${LAB_SECS.find((x) => x.id === sec)!.name} buffs`, "+50% stronger"]);
    for (const sec of f.longer) rows.push([`${LAB_SECS.find((x) => x.id === sec)!.name} buffs`, "last twice as long"]);
    if (f.cron) rows.push(["Cron job", "repeats your last compile"]);
    return rows;
}
/** Bank crash-dump Intel (on a Reboot) or event Intel. Returns the Intel added. */
function labLump(s: State, secs: number): number {
    if (!s.lab.seen) return 0;
    const got = intelRate(s) * secs * (1 + labFx(s).dumps);
    s.lab.intel += got;
    s.life.intel += got;
    return got;
}
/** Advance the lab by dt seconds: Intel, the compile queue, running buffs and the dump buffer. Returns payloads finished. */
export function labStep(s: State, dt: number, bytesPerSec: number): PayloadId[] {
    const L = s.lab;
    if (!L.seen) {
        if (!isUnlocked(s, LAB_TUNE.opensAt)) return [];
        L.seen = true;
    }
    const gain = intelRate(s, bytesPerSec) * dt;
    L.intel += gain;
    s.life.intel += gain;
    L.dump = Math.min(LAB_TUNE.dumpSecs, L.dump + dt);
    for (const r of L.run) r.left = Math.max(0, r.left - dt);
    if (L.run.some((r) => r.left <= 0)) L.run = L.run.filter((r) => r.left > 0);
    const done: PayloadId[] = [];
    let t = dt;
    while (t > 0 && L.queue.length) {
        const q = L.queue[0];
        const use = Math.min(t, q.left);
        q.left -= use;
        t -= use;
        if (q.left <= 1e-9) {
            L.queue.shift();
            L.stock[q.id] = Math.min(LAB_TUNE.stockMax, (L.stock[q.id] ?? 0) + 1);
            s.life.compiled += 1;
            done.push(q.id);
            if (!L.queue.length && labFx(s).cron && L.last) compile(s, L.last);
        }
    }
    return done;
}

// ---- Drone hangar. Drones grow into a system you build across Ascends, on three clocks:
//  - postings and zone mastery (forever): post a Drone to one zone and it presses only there, faster; its work there builds
//    that zone's mastery (ranks I to V, a permanent boost to the zone's output). Every rank earns one Core.
//  - Parts and mods (one run): every press a Drone attempts salvages Parts; Parts buy three mods per Drone (Servo, Uplink, Reach).
//  - the drone tree (forever): Cores buy nodes in a small 18-node tree on the shared tree menu (amber "hangar" skin).
// See docs/node-farm.md "Drone hangar".
export const DRONE_TUNE = {
    postX: 3, // a posted Drone presses this many times as fast on its zone
    partK: 0.1, // Parts per attempted press
    reachEach: 0.2, // each Reach level presses the tier below at this share of the Drone's speed
    servoEach: 0.25, // each Servo level: Drone speed +this
    uplinkEach: 1, // each Uplink level: posting speed +this (x3 -> x4)
    modMax: 5,
    modBase: 25, // a mod costs modBase * modGrowth^level * modTier^tier Parts
    modGrowth: 3,
    modTier: 2.5,
    // service (attempted presses on a zone) needed for mastery ranks I..V, and each rank's output multiplier
    rankAt: [500, 10000, 200000, 4000000, 80000000],
    rankX: [1, 1.05, 1.1, 1.16, 1.23, 1.35],
    nodeCost: [1, 2, 2, 4, 4, 8], // Cores per tree slot
};
/** Zones a Drone can work: every button stat except Reboots, in chain order. */
export const POSTABLE: readonly ButtonStat[] = ["mult", ...MATS];
export type ModId = "servo" | "uplink" | "reach";
export const MODS: { id: ModId; name: string; blurb: string }[] = [
    { id: "servo", name: "Servo", blurb: "presses 25% faster per level" },
    { id: "uplink", name: "Uplink", blurb: "posting speed +1x per level" },
    { id: "reach", name: "Reach", blurb: "also presses the tier below at 20% per level" },
];
export interface DroneState {
    /** each tier's posting, or null to sweep every armed zone (kept through Ascend) */
    post: (ButtonStat | null)[];
    /** service per zone: presses attempted there by posted Drones (kept forever) */
    svc: Partial<Record<ButtonStat, number>>;
    /** Parts, salvaged from presses (reset on Ascend) */
    parts: number;
    /** mod levels [tier][servo, uplink, reach] (reset on Ascend) */
    mods: number[][];
    /** owned drone tree nodes (kept through Ascend) */
    nodes: string[];
    /** fractional presses waiting, posted and reach (per tier) */
    pacc: number[];
    racc: number[];
}
export const freshDr = (): DroneState => ({ post: Array(TIERS).fill(null), svc: {}, parts: 0, mods: Array.from({ length: TIERS }, () => [0, 0, 0]), nodes: [], pacc: Array(TIERS).fill(0), racc: Array(TIERS).fill(0) });

// -- the drone tree
export type DroneSec = "flight" | "dispatch" | "salvage";
export const DRONE_SECS: { id: DroneSec; name: string; blurb: string; color: string }[] = [
    { id: "flight", name: "Flight", blurb: "How fast every Drone presses.", color: "#ffb14a" },
    { id: "dispatch", name: "Dispatch", blurb: "Postings and zone mastery.", color: "#6bffc9" },
    { id: "salvage", name: "Salvage", blurb: "Parts, mods and the hangar itself.", color: "#ff7a4a" },
];
export interface DroneFx {
    speed?: number; // every Drone x(1 + this)
    off?: number; // added to Drone speed while away
    formation?: number; // every Drone +this per posted Drone
    servoMax?: number; // extra Servo levels
    sweep?: number; // sweeping Drones x(1 + this)
    rankSpeed?: number; // every Drone +this per mastery rank
    postX?: number; // posting speed +this
    sweepSvc?: number; // sweeping earns this share of mastery
    svc?: number; // mastery builds x(1 + this) as fast
    rankPow?: number; // mastery bonuses x(1 + this) stronger
    relay?: number; // a posting also gives this share of its mastery to the next zone up the chain
    garrison?: boolean; // posted Drones also sweep
    parts?: number; // Parts x(1 + this)
    modCost?: number; // mods cost this fraction less
    droneCost?: number; // Drones cost this fraction less Aether
    modKeep?: number; // share of mod levels and Parts kept through Ascend
    droneMax?: number; // extra Drone levels per tier
    modGlobal?: number; // everything +this per mod level owned
}
export interface DroneNode { id: string; branch: DroneSec; kind: TreeKind; name: string; blurb: string; flavor: string; cost: number; links: string[]; fx: DroneFx; x: number; y: number; ix: number; sprite: string }
type DroneRow = [slot: number, id: string, kind: TreeKind, name: string, blurb: string, flavor: string, fx: DroneFx];
const DRONE_ARMS: Record<DroneSec, DroneRow[]> = {
    flight: [
        [0, "dx_burner", "minor", "Afterburner", "Every Drone presses 50% faster.", "Bolted a second fan on. The hangar smells like ozone now.", { speed: 0.5 }],
        [1, "dx_formation", "minor", "Formation", "Every Drone presses 10% faster for each Drone on a posting.", "They fly tighter when someone is out front.", { formation: 0.1 }],
        [2, "dx_night", "minor", "Night flight", "Drones work 25% harder while you are away.", "Running lights off. They know the way.", { off: 0.25 }],
        [3, "dx_overdrive", "notable", "Overdrive", "Servo mods go to level 8.", "The servos were rated for five. They took eight without a word.", { servoMax: 3 }],
        [4, "dx_slipstream", "notable", "Slipstream", "Sweeping Drones press 50% faster.", "Each one rides the wake of the one before it.", { sweep: 0.5 }],
        [5, "dx_hivemind", "keystone", "Hivemind", "Drones press twice as fast, and every mastery rank adds 1% more.", "Six frames, one thought. The thought is mostly about buttons.", { speed: 1, rankSpeed: 0.01 }],
    ],
    dispatch: [
        [0, "dx_orders", "minor", "Field orders", "Posted Drones press x4 on their zone.", "Clear orders, one zone each. Nobody wanders.", { postX: 1 }],
        [1, "dx_patrol", "minor", "Patrol logs", "Sweeping Drones also build mastery, at a quarter of the rate.", "They write down every zone they pass. Most of it is useful.", { sweepSvc: 0.25 }],
        [2, "dx_tour", "minor", "Long tour", "Mastery builds twice as fast.", "Same zone, same shift, every day. They learn the creaks.", { svc: 1 }],
        [3, "dx_fieldops", "notable", "Field ops", "Mastery bonuses are 50% stronger.", "The veterans train the new frames. Nobody asked them to.", { rankPow: 0.5 }],
        [4, "dx_relay", "notable", "Relay mast", "Each posting also builds half as much mastery in the next zone up the chain.", "Every posting gets a mast. The mast talks to the zone next door.", { relay: 0.5 }],
        [5, "dx_garrison", "keystone", "Garrison", "Posted Drones also sweep every armed zone at full speed.", "Stationed, and still somehow everywhere.", { garrison: true }],
    ],
    salvage: [
        [0, "dx_scrap", "minor", "Scrapper", "Parts x2.", "Every press sheds a little metal. Now somebody sweeps it up.", { parts: 1 }],
        [1, "dx_refit", "minor", "Refit bench", "Mods cost 40% less.", "A proper bench, a proper light. Refits take half the swearing.", { modCost: 0.4 }],
        [2, "dx_credit", "minor", "Hangar credit", "Drones cost 40% less Aether.", "The supplier knows the hangar by name now.", { droneCost: 0.4 }],
        [3, "dx_blackbox", "notable", "Black box", "Keep half your mod levels and Parts through every Ascend.", "The frames reset. The flight recorders don't.", { modKeep: 0.5 }],
        [4, "dx_frames", "notable", "Spare frames", "Drones go 2 levels higher.", "Two more chassis on the rack, wired and waiting.", { droneMax: 2 }],
        [5, "dx_foundry", "keystone", "Foundry", "Every mod level adds +1% to everything.", "The hangar builds its own parts now. Then it builds better ones.", { modGlobal: 0.01 }],
    ],
};
const DRONE_ORDER: DroneSec[] = ["flight", "dispatch", "salvage"];
function buildDroneTree(): DroneNode[] {
    const out: DroneNode[] = [];
    DRONE_ORDER.forEach((arm, ai) => {
        // arms point down-left, up and down-right, so the tree reads as a three-rotor frame
        const th = -Math.PI / 2 + (ai * 2 * Math.PI) / DRONE_ORDER.length;
        const c = Math.cos(th), sn = Math.sin(th);
        const ids: string[] = [];
        for (const [slot, id, kind, name, blurb, flavor, fx] of DRONE_ARMS[arm]) {
            const [u, v] = LAB_SLOTS[slot];
            out.push({ id, branch: arm, kind, name, blurb, flavor, fx, cost: DRONE_TUNE.nodeCost[slot], links: slot === 0 ? ["core"] : [], x: +(u * c - v * sn).toFixed(3), y: +(u * sn + v * c).toFixed(3), ix: out.length, sprite: id });
            ids[slot] = id;
        }
        LAB_SLOTS.forEach(([, , ls], slot) => ls.forEach((l) => {
            const A = out.find((n) => n.id === ids[slot])!, B = out.find((n) => n.id === ids[l])!;
            A.links.push(B.id);
            B.links.push(A.id);
        }));
    });
    return out;
}
export const DRONE_TREE: DroneNode[] = buildDroneTree();
const DT_BY = new Map(DRONE_TREE.map((n) => [n.id, n]));
export const droneNode = (id: string) => DT_BY.get(id)!;
type DroneFxSum = Required<Omit<DroneFx, "garrison">> & { garrison: boolean };
let dfxKey = "";
let dfxVal: DroneFxSum | null = null;
/** What the owned drone tree nodes add up to (cached on the owned list). */
export function droneFx(s: State): DroneFxSum {
    const nodes = s.dr?.nodes ?? [];
    const key = nodes.join(",");
    if (dfxVal && key === dfxKey) return dfxVal;
    const o: DroneFxSum = { speed: 0, off: 0, formation: 0, servoMax: 0, sweep: 0, rankSpeed: 0, postX: 0, sweepSvc: 0, svc: 0, rankPow: 0, relay: 0, garrison: false, parts: 0, modCost: 0, droneCost: 0, modKeep: 0, droneMax: 0, modGlobal: 0 };
    for (const id of nodes) {
        const f = DT_BY.get(id)?.fx;
        if (!f) continue;
        for (const [k, v] of Object.entries(f)) {
            if (k === "garrison") o.garrison = o.garrison || !!v;
            else if (k === "speed") o.speed = (1 + o.speed) * (1 + (v as number)) - 1; // speed boosts multiply
            else { const r = o as unknown as Record<string, number>; r[k] = (r[k] ?? 0) + (v as number); }
        }
    }
    dfxKey = key;
    dfxVal = o;
    return o;
}
export const droneTreeHas = (s: State, id: string) => s.dr.nodes.includes(id);
export const droneNodeOpen = (s: State, n: DroneNode) => n.links.some((l) => l === "core" || s.dr.nodes.includes(l));
export function droneVis(s: State, n: DroneNode): NodeVis {
    if (s.dr.nodes.includes(n.id) || droneNodeOpen(s, n)) return "shown";
    return n.links.some((l) => l !== "core" && droneNodeOpen(s, DT_BY.get(l)!)) ? "fog" : "hidden";
}

// -- mastery
export const zoneSvc = (s: State, st: ButtonStat) => s.dr.svc[st] ?? 0;
export function rankOf(svc: number): number { let r = 0; while (r < DRONE_TUNE.rankAt.length && svc >= DRONE_TUNE.rankAt[r]) r++; return r; }
export const zoneRank = (s: State, st: ButtonStat) => rankOf(zoneSvc(s, st));
/** Service needed for the next rank, or null at rank V. */
export const nextRankAt = (s: State, st: ButtonStat) => { const r = zoneRank(s, st); return r < DRONE_TUNE.rankAt.length ? DRONE_TUNE.rankAt[r] : null; };
export const ROMAN = ["", "I", "II", "III", "IV", "V"];
/** A zone's output multiplier from its mastery rank. */
export function masteryMul(s: State, st: ButtonStat): number {
    if (!s.dr) return 1;
    const r = zoneRank(s, st);
    return r ? 1 + (DRONE_TUNE.rankX[r] - 1) * (1 + droneFx(s).rankPow) : 1;
}
export const masteryRanks = (s: State) => POSTABLE.reduce((a, st) => a + zoneRank(s, st), 0);
/** Cores: one per mastery rank ever earned, minus what the drone tree has spent. */
export const coresEarned = (s: State) => masteryRanks(s);
export const coresSpent = (s: State) => s.dr.nodes.reduce((a, id) => a + (DT_BY.get(id)?.cost ?? 0), 0);
export const cores = (s: State) => Math.max(0, coresEarned(s) - coresSpent(s));
function addSvc(s: State, st: ButtonStat, n: number, fx: DroneFxSum) {
    const v = n * (1 + fx.svc);
    s.dr.svc[st] = Math.min(CAP, (s.dr.svc[st] ?? 0) + v);
    if (fx.relay) {
        const i = POSTABLE.indexOf(st);
        const nb = POSTABLE[i + 1] ?? POSTABLE[i - 1];
        if (nb) s.dr.svc[nb] = Math.min(CAP, (s.dr.svc[nb] ?? 0) + v * fx.relay);
    }
}

// -- postings and speed
/** Where a tier's Drone works: its posted zone while that zone is open, or null (it sweeps). */
export function postOf(s: State, tier: number): ButtonStat | null {
    const p = s.dr.post[tier];
    return p && isUnlocked(s, p) ? p : null;
}
export function setPost(s: State, tier: number, st: ButtonStat | null): boolean {
    if (tier < 0 || tier >= TIERS) return false;
    if (st !== null && (!POSTABLE.includes(st) || !isUnlocked(s, st))) return false;
    s.dr.post[tier] = st;
    return true;
}
export const postX = (s: State, tier: number) => DRONE_TUNE.postX + droneFx(s).postX + (s.dr.mods[tier]?.[1] ?? 0) * DRONE_TUNE.uplinkEach;
/** The hangar's part of a Drone's speed: Servo, the tree, Formation and Hivemind. */
export function hangarSpeed(s: State, tier: number): number {
    if (!s.dr) return 1;
    const fx = droneFx(s);
    let x = (1 + (s.dr.mods[tier]?.[0] ?? 0) * DRONE_TUNE.servoEach) * (1 + fx.speed);
    if (fx.formation) x *= 1 + fx.formation * s.dr.post.filter((p, k) => p && s.drones[k] > 0 && isUnlocked(s, p)).length;
    if (fx.rankSpeed) x *= 1 + fx.rankSpeed * masteryRanks(s);
    return x;
}
/** Parts salvaged per second right now (the same sums droneStep makes). */
export function partsRate(s: State): number {
    const fx = droneFx(s);
    const sweep = s.armed.filter((st) => st !== "bytes" && st !== "reboot" && isUnlocked(s, st as StatId)).length;
    let u = 0;
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        const r = droneRate(s, k), post = postOf(s, k);
        if (post) u += r * postX(s, k) + (fx.garrison ? r * sweep : 0);
        else u += r * (1 + fx.sweep) * sweep;
    }
    return u * DRONE_TUNE.partK * (1 + fx.parts);
}
/** Mastery per second on a zone from the Drones posted there (and patrols). */
export function svcRate(s: State, st: ButtonStat): number {
    const fx = droneFx(s);
    const armed = s.armed.includes(st) && isUnlocked(s, st);
    let u = 0;
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        const r = droneRate(s, k), post = postOf(s, k);
        if (post === st) u += r * postX(s, k);
        if (fx.sweepSvc && armed && (!post || fx.garrison)) u += r * (post ? 1 : 1 + fx.sweep) * fx.sweepSvc;
    }
    return u * (1 + fx.svc);
}
export const modLevels = (s: State) => s.dr.mods.reduce((a, m) => a + m[0] + m[1] + m[2], 0);
/** Foundry: everything +1% per mod level. */
export const foundryAll = (s: State) => (s.dr ? 1 + droneFx(s).modGlobal * modLevels(s) : 1);

// -- mods
export const modMax = (s: State, mod: number) => DRONE_TUNE.modMax + (mod === 0 ? droneFx(s).servoMax : 0);
export const modCost = (s: State, tier: number, mod: number) => DRONE_TUNE.modBase * Math.pow(DRONE_TUNE.modGrowth, s.dr.mods[tier][mod]) * Math.pow(DRONE_TUNE.modTier, tier) * (1 - droneFx(s).modCost);
export type ModFail = "drone" | "max" | "parts";
export function modBlock(s: State, tier: number, mod: number): ModFail | null {
    if (s.drones[tier] <= 0) return "drone";
    if (s.dr.mods[tier][mod] >= modMax(s, mod)) return "max";
    if (s.dr.parts < modCost(s, tier, mod)) return "parts";
    return null;
}
export function buyMod(s: State, tier: number, mod: number): boolean {
    if (tier < 0 || tier >= TIERS || mod < 0 || mod > 2 || modBlock(s, tier, mod)) return false;
    s.dr.parts -= modCost(s, tier, mod);
    s.dr.mods[tier][mod] += 1;
    return true;
}

// -- tree buying
export function buyDroneNode(s: State, id: string): boolean {
    const n = DT_BY.get(id);
    if (!n || s.dr.nodes.includes(id) || !droneNodeOpen(s, n) || cores(s) < n.cost) return false;
    s.dr.nodes.push(id);
    return true;
}
/** Free respec: every Core comes back. Mod levels above the new caps are trimmed, without refund. Returns Cores refunded. */
export function respecDrones(s: State): number {
    const back = coresSpent(s);
    s.dr.nodes = [];
    for (const m of s.dr.mods) m[0] = Math.min(m[0], modMax(s, 0));
    s.drones = s.drones.map((lv) => Math.min(lv, droneMax(s)));
    return back;
}
/** What the owned drone tree gives, as label and value rows for the tree readout. */
export function droneTreeTotals(s: State): [string, string][] {
    const f = droneFx(s);
    const rows: [string, string][] = [];
    rows.push(["Mastery ranks", `${masteryRanks(s)} of ${POSTABLE.length * 5}`]);
    if (f.speed) rows.push(["Drone speed", `x${+(1 + f.speed).toFixed(2)}`]);
    if (f.formation) rows.push(["Formation", `+${Math.round(f.formation * 100)}% per posted Drone`]);
    if (f.off) rows.push(["Away speed", `+${Math.round(f.off * 100)}%`]);
    if (f.servoMax) rows.push(["Servo cap", `level ${DRONE_TUNE.modMax + f.servoMax}`]);
    if (f.sweep) rows.push(["Sweeping", `x${1 + f.sweep}`]);
    if (f.rankSpeed) rows.push(["Hivemind", `+${Math.round(f.rankSpeed * masteryRanks(s) * 100)}% speed`]);
    rows.push(["Posting speed", `x${DRONE_TUNE.postX + f.postX} before Uplink`]);
    if (f.sweepSvc) rows.push(["Patrol mastery", `${Math.round(f.sweepSvc * 100)}%`]);
    if (f.svc) rows.push(["Mastery speed", `x${1 + f.svc}`]);
    if (f.rankPow) rows.push(["Mastery bonus", `+${Math.round(f.rankPow * 100)}% stronger`]);
    if (f.relay) rows.push(["Relay mast", `${Math.round(f.relay * 100)}% to the next zone`]);
    if (f.garrison) rows.push(["Garrison", "posted Drones also sweep"]);
    if (f.parts) rows.push(["Parts", `x${1 + f.parts}`]);
    if (f.modCost) rows.push(["Mod prices", `-${Math.round(f.modCost * 100)}%`]);
    if (f.droneCost) rows.push(["Drone prices", `-${Math.round(f.droneCost * 100)}%`]);
    if (f.modKeep) rows.push(["Kept on Ascend", `${Math.round(f.modKeep * 100)}% of mods and Parts`]);
    if (f.droneMax) rows.push(["Drone levels", `+${f.droneMax}`]);
    if (f.modGlobal) rows.push(["Foundry", `+${Math.round(f.modGlobal * modLevels(s) * 100)}% everything`]);
    return rows;
}
/** The hangar after an Ascend: postings, mastery and the tree stay; Parts and mods reset (Black box keeps a share). */
function drOnAscend(s: State): DroneState {
    const keep = droneFx(s).modKeep;
    return {
        ...s.dr,
        parts: Math.floor(s.dr.parts * keep),
        mods: s.dr.mods.map((m) => m.map((lv) => Math.floor(lv * keep))),
        pacc: Array(TIERS).fill(0),
        racc: Array(TIERS).fill(0),
    };
}
/** A saved hangar, checked field by field; anything odd falls back to fresh. */
function parseDr(o: unknown): DroneState {
    const b = freshDr();
    if (!o || typeof o !== "object") return b;
    const x = o as Partial<DroneState>;
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const arr = (v: unknown) => (Array.isArray(v) && v.length === TIERS ? v.map((n) => Math.max(0, num(n))) : Array(TIERS).fill(0));
    return {
        post: Array.isArray(x.post) && x.post.length === TIERS ? x.post.map((p) => (POSTABLE.includes(p as ButtonStat) ? (p as ButtonStat) : null)) : b.post,
        svc: Object.fromEntries(Object.entries(x.svc ?? {}).filter(([k, v]) => POSTABLE.includes(k as ButtonStat) && num(v) > 0).map(([k, v]) => [k, num(v)])),
        parts: Math.max(0, num(x.parts)),
        mods: Array.isArray(x.mods) && x.mods.length === TIERS ? x.mods.map((m) => (Array.isArray(m) && m.length === 3 ? m.map((lv) => Math.max(0, Math.floor(num(lv)))) : [0, 0, 0])) : b.mods,
        nodes: Array.isArray(x.nodes) ? [...new Set(x.nodes.filter((id) => DT_BY.has(id)))] : [],
        pacc: arr(x.pacc),
        racc: arr(x.racc),
    };
}

// ---- Handover: the reset past Ascend (second prestige layer). Reaching Node zero (Origin production) lets you hand the
// node to the next operator, the way Wren, Tamsin, Osk and Vael did. It wipes everything Ascend wipes plus AP, perks, the
// prestige tree, Drones, Mounted drives and the lab's Intel and stock. It keeps goals, secrets, logs, lifetime stats and
// Exploit Lab research. It pays Keys, which buy Firmware (a small green tree that changes the rules of every later run),
// and you pick one operator protocol that shapes the next cycle. docs/node-farm.md "Handover".
export type ProtoId = "wren" | "tamsin" | "osk" | "vael";
export type FwSec = "boot" | "memory" | "relay";
export const HAND_TUNE = {
    needProd: 1, // Origin producers you need this run before you can hand over
    keysPerNode: 1 / 6, // Keys per prestige-tree node (and extra rank) owned at the Handover
    keysPerOriginLog: 1, // Keys grow with the square root of Origin's power of ten (1e9 Origin: +3, 1e100: +10)
    keysBase: 1, // every Handover pays at least this
    nodeCost: [2, 3, 3, 6, 6, 12], // Keys per Firmware slot (notables x1.25): about six Handovers to own all 18
    fwScale: 1, // scales every Firmware price (pacing knob)
    protoX: 2, // a protocol's main boost: x(1 + protoX); Dual boot runs the second one at half
    vaelPay: 120, // seconds of production every event win pays under Vael's protocol
    standbyHours: 8, // Hot standby: extra offline hours
    warmReboots: 25, // Warm boot
    bootProd: 10, // Bootloader: producers on Copper to Aether
    afterglow: 180, // Afterglow: seconds of Overclock at the start of every Ascend
    noteMax: 140, // characters in a handover note
    apPerHand: 1, // every Handover done: AP on Ascend x(1 + this * Handovers), so each cycle rebuilds the tree faster
};
export const PROTOS: { id: ProtoId; op: string; name: string; blurb: string; flavor: string; color: string }[] = [
    { id: "wren", op: "Wren", name: "Tape and fans", blurb: "Multiplier buttons add x3 and Reboots hit x2 as hard.", flavor: "Get it booting first. Make it pretty never.", color: "#b6f04a" },
    { id: "tamsin", op: "Tamsin", name: "Ledger", blurb: "Intel x3, and every goal and secret gives twice its bonus.", flavor: "Write down every price you pay. You will want it later.", color: "#2fd8e8" },
    { id: "osk", op: "Osk", name: "Screwdriver", blurb: "Drones press x3 as fast and cost half.", flavor: "If you do a thing twice, build a Drone for it.", color: "#f08a3c" },
    { id: "vael", op: "Vael", name: "Listening", blurb: "Events come twice as often, and every win pays 2 minutes of production.", flavor: "Answer every knock. Somebody is always there.", color: "#ffc53a" },
];
export const protoDef = (id: ProtoId) => PROTOS.find((p) => p.id === id)!;
export interface FwFx {
    kitReboot?: number; // every Ascend starts with this many Reboots
    kitProd?: number; // every Ascend starts with this many producers on Copper, Silicon, Quartz and Aether
    afterglow?: number; // every Ascend starts with this many seconds of Overclock
    unlockMul?: number; // materials open at this fraction of the usual amount
    rootPath?: number; // Engrams, Paradox and Origin open at this fraction
    ascendAt?: number; // Ascend needs this fraction of the usual Aether
    preinstall?: boolean; // Watchdog timer, Standing orders and Forecast work without their tree nodes
    keepEntry?: boolean; // Handover keeps the entry node of every tree section
    keepUpper?: boolean; // Handover keeps the upper path of every tree section
    perkKeep?: number; // Handover keeps this fraction of every perk's levels
    labKeep?: boolean; // Ascend keeps Intel and running payloads
    droneKeep?: number; // Drones keep this fraction of their levels through Ascend
    apRefund?: number; // Handover gives back this fraction of the AP the tree cost
    keys?: number; // Handovers pay x(1 + this) Keys
    anyAscend?: boolean; // the protocol can be changed at any time
    standby?: boolean; // more offline hours, Drones at full speed while away
    dual?: boolean; // a second protocol runs at half strength
    lineage?: number; // everything +this per Handover done
}
export const PREINSTALLED: Feature[] = ["watchdog", "orders", "forecast"];
export interface FwNode { id: string; branch: FwSec; kind: TreeKind; name: string; blurb: string; flavor: string; cost: number; links: string[]; fx: FwFx; x: number; y: number; ix: number; sprite: string; entry?: boolean }
export const FW_SECS: { id: FwSec; name: string; blurb: string; color: string }[] = [
    { id: "boot", name: "Boot", blurb: "How every run starts.", color: "#3dff6e" },
    { id: "memory", name: "Memory", blurb: "What survives Ascend and Handover.", color: "#ffc53a" },
    { id: "relay", name: "Relay", blurb: "Keys, protocols and the long haul.", color: "#64e6ff" },
];
type FwRow = [slot: number, id: string, kind: TreeKind, name: string, blurb: string, flavor: string, fx: FwFx];
const FW_ARMS: Record<FwSec, FwRow[]> = {
    boot: [
        [0, "fw_warm", "minor", "Warm boot", `Every Ascend starts with ${HAND_TUNE.warmReboots} Reboots.`, "Leave the fans running between operators. The rack never gets cold.", { kitReboot: HAND_TUNE.warmReboots }],
        [1, "fw_preinstall", "minor", "Preinstalled", "Watchdog timer, Standing orders and Forecast work without their tree nodes.", "The good tools ship with the box now.", { preinstall: true }],
        [2, "fw_afterglow", "minor", "Afterglow", "Every Ascend starts with a 3 minute Overclock.", "The node comes back up still warm from the last run.", { afterglow: HAND_TUNE.afterglow }],
        [3, "fw_bootloader", "notable", "Bootloader", `Every Ascend starts with ${HAND_TUNE.bootProd} producers on Copper, Silicon, Quartz and Aether.`, "Skip the tutorial. The node knows the way to the forge.", { kitProd: HAND_TUNE.bootProd }],
        [4, "fw_fastpath", "notable", "Fast path", "Every material opens at half the usual amount.", "Shorter cable, same signal.", { unlockMul: 0.5 }],
        [5, "fw_shortfuse", "keystone", "Short fuse", "Ascend needs half the usual Aether.", "You know where the top is now. Go up sooner.", { ascendAt: 0.5 }],
    ],
    memory: [
        [0, "fw_imprint", "minor", "Imprint", "Handover keeps the entry node of every prestige tree section.", "The first five nodes leave a mark the wipe can't reach.", { keepEntry: true }],
        [1, "fw_perkcache", "minor", "Perk cache", "Handover keeps half of every perk's levels.", "Taped the perk settings to the inside of the case.", { perkKeep: 0.5 }],
        [2, "fw_labimage", "minor", "Lab image", "Ascend keeps your Intel and running payloads.", "The bench gets imaged before every wipe.", { labKeep: true }],
        [3, "fw_deepimprint", "notable", "Deep imprint", "Handover also keeps the upper path of every tree section.", "Walk the same path enough times and it stays walked.", { keepUpper: true }],
        [4, "fw_droneram", "notable", "Drone RAM", "Drones keep half their levels through Ascend.", "Osk gave every Drone a little memory. They remember the buttons.", { droneKeep: 0.5 }],
        [5, "fw_tape", "keystone", "Tape backup", "Handover gives back a quarter of the AP your tree cost.", "Everything important on one tape. The tape is labelled. Tamsin labelled it.", { apRefund: 0.25 }],
    ],
    relay: [
        [0, "fw_keysmith", "minor", "Keysmith", "Handovers pay x1.5 Keys.", "Cut a spare. Then cut a spare of the spare.", { keys: 0.5 }],
        [1, "fw_desk", "minor", "Operator's desk", "Change your protocol at any time, not only at a Handover.", "A chair, a lamp, and the right to change your mind.", { anyAscend: true }],
        [2, "fw_standby", "minor", "Hot standby", "Time away banks 8 more hours, and Drones work at full speed while you are gone.", "The node does not sleep. It only waits.", { standby: true }],
        [3, "fw_dual", "notable", "Dual boot", "Run a second protocol at half strength.", "Two operators on one node. They take turns with the chair.", { dual: true }],
        [4, "fw_rootpath", "notable", "Root path", "Engrams, Paradox and Origin open at a quarter of the usual amount.", "There is a shorter way down to node zero. It was always there.", { rootPath: 0.25 }],
        [5, "fw_lineage", "keystone", "Lineage", "Everything +50% for every Handover you have done.", "Every operator who left made the node a little stronger.", { lineage: 0.5 }],
    ],
};
const FW_ORDER: FwSec[] = ["boot", "memory", "relay"];
// same small diamond as the lab tree: entry, two paths of two, keystone
const FW_SLOTS: [number, number, number[]][] = [[2.3, 0, []], [3.9, -1.1, [0]], [3.9, 1.1, [0]], [5.7, -1.25, [1]], [5.7, 1.25, [2]], [7.5, 0, [3, 4]]];
function buildFw(): FwNode[] {
    const out: FwNode[] = [];
    FW_ORDER.forEach((arm, ai) => {
        // rotated a sixth of a turn from the lab so the two trees never look the same
        const th = -Math.PI / 2 + Math.PI / 3 + (ai * 2 * Math.PI) / FW_ORDER.length;
        const c = Math.cos(th), sn = Math.sin(th);
        const ids: string[] = [];
        for (const [slot, id, kind, name, blurb, flavor, fx] of FW_ARMS[arm]) {
            const [u, v] = FW_SLOTS[slot];
            out.push({
                id, branch: arm, kind, name, blurb, flavor, fx,
                cost: Math.max(1, Math.round(HAND_TUNE.nodeCost[slot] * (kind === "notable" ? 1.25 : 1) * HAND_TUNE.fwScale)),
                links: slot === 0 ? ["core"] : [],
                x: +(u * c - v * sn).toFixed(3), y: +(u * sn + v * c).toFixed(3),
                ix: out.length, sprite: id,
                ...(slot === 0 ? { entry: true } : {}),
            });
            ids[slot] = id;
        }
        FW_SLOTS.forEach(([, , ls], slot) => ls.forEach((l) => {
            const A = out.find((n) => n.id === ids[slot])!, B = out.find((n) => n.id === ids[l])!;
            A.links.push(B.id);
            B.links.push(A.id);
        }));
    });
    return out;
}
export const FW: FwNode[] = buildFw();
const FW_BY = new Map(FW.map((n) => [n.id, n]));
export const fwNode = (id: string) => FW_BY.get(id)!;
export const fwHas = (s: State, id: string) => s.hand.fw.includes(id);
export const fwNodeOpen = (s: State, n: FwNode) => n.links.some((l) => l === "core" || s.hand.fw.includes(l));
export function fwVis(s: State, n: FwNode): NodeVis {
    if (s.hand.fw.includes(n.id) || fwNodeOpen(s, n)) return "shown";
    return n.links.some((l) => l !== "core" && fwNodeOpen(s, FW_BY.get(l)!)) ? "fog" : "hidden";
}

export interface HandNote { n: number; text: string; at: number; proto: ProtoId | null }
export interface HandState {
    /** Keys held */
    keys: number;
    /** owned Firmware node ids */
    fw: string[];
    /** the protocol running this cycle, and the second one (Dual boot) */
    proto: ProtoId | null;
    proto2: ProtoId | null;
    /** Handovers done */
    count: number;
    /** Keys earned in all */
    keysTotal: number;
    /** AP earned by Ascends since the last Handover (shown on the window) */
    cycleAp: number;
    /** life.secs when this cycle started */
    cycleAt: number;
    /** the notes you left at each Handover, oldest first */
    notes: HandNote[];
}
export const freshHand = (): HandState => ({ keys: 0, fw: [], proto: null, proto2: null, count: 0, keysTotal: 0, cycleAp: 0, cycleAt: 0, notes: [] });

const HFX_CACHE = new WeakMap<string[], { n: number; v: ReturnType<typeof handFxRaw> }>();
/** What the owned Firmware adds up to. Cached per Firmware array. */
export function handFx(s: State) {
    const arr = s.hand.fw;
    const hit = HFX_CACHE.get(arr);
    if (hit && hit.n === arr.length) return hit.v;
    const v = handFxRaw(arr);
    HFX_CACHE.set(arr, { n: arr.length, v });
    return v;
}
function handFxRaw(ids: string[]) {
    const o = { kitReboot: 0, kitProd: 0, afterglow: 0, unlockMul: 1, rootPath: 1, ascendAt: 1, preinstall: false, keepEntry: false, keepUpper: false, perkKeep: 0, labKeep: false, droneKeep: 0, apRefund: 0, keys: 0, anyAscend: false, standby: false, dual: false, lineage: 0 };
    for (const id of ids) {
        const f = FW_BY.get(id)?.fx;
        if (!f) continue;
        o.kitReboot += f.kitReboot ?? 0;
        o.kitProd += f.kitProd ?? 0;
        o.afterglow += f.afterglow ?? 0;
        o.unlockMul *= f.unlockMul ?? 1;
        o.rootPath *= f.rootPath ?? 1;
        o.ascendAt *= f.ascendAt ?? 1;
        o.perkKeep = Math.max(o.perkKeep, f.perkKeep ?? 0);
        o.droneKeep = Math.max(o.droneKeep, f.droneKeep ?? 0);
        o.apRefund += f.apRefund ?? 0;
        o.keys += f.keys ?? 0;
        o.lineage += f.lineage ?? 0;
        for (const k of ["preinstall", "keepEntry", "keepUpper", "labKeep", "anyAscend", "standby", "dual"] as const) if (f[k]) o[k] = true;
    }
    return o;
}
/** How strongly a protocol runs: 1 for the main one, 0.5 for the Dual boot one, else 0. */
export function protoK(s: State, id: ProtoId): number {
    if (!s.hand) return 0;
    if (s.hand.proto === id) return 1;
    return s.hand.proto2 === id && handFx(s).dual ? 0.5 : 0;
}
/** Lineage: everything +50% per Handover done. */
/** Arc clears (lib/nodefarm/arcs.ts fills this when it is imported, like RIG_HOOKS): how many arcs have every button pressed once. */
export const ARC_HOOKS: { cleared?: (s: State) => number } = {};
export const handGlobal = (s: State) => (s.hand ? 1 + handFx(s).lineage * s.hand.count : 1);
/** The node remembers: every Handover done multiplies AP on Ascend. */
export const handAp = (s: State) => (s.hand ? 1 + HAND_TUNE.apPerHand * s.hand.count : 1);
/** Aether you need to Ascend (Short fuse halves it). */
export const ascendNeed = (s: State) => TUNE.ascendAether * (s.hand ? handFx(s).ascendAt : 1);
const ROOT_MATS: readonly MatId[] = ["engrams", "paradox", "origin"];
/** How much of the stat below a material needs before it opens (the tree's Assay, Fast path and Root path). */
export function unlockNeed(s: State, id: StatId): number {
    const hf = s.hand ? handFx(s) : null;
    return TUNE.unlockAt[id] * treeFx(s).unlockMul * (hf ? hf.unlockMul * (ROOT_MATS.includes(id as MatId) ? hf.rootPath : 1) : 1);
}
/** Starting kit from Firmware, applied at the start of every Ascend and Handover. */
function bootKit(s: State) {
    const hf = handFx(s);
    s.reboot += hf.kitReboot;
    for (const m of ["copper", "silicon", "quartz", "aether"] as const) s.prod[m] += hf.kitProd;
    if (hf.afterglow > 0) s.overclock = Math.max(s.overclock, hf.afterglow);
}

/** Node zero: the run has Origin producers. */
export const handOpen = (s: State) => s.prod.origin >= HAND_TUNE.needProd;
/** Has the player ever seen the Handover (Origin opened, or one done)? */
export const handSeen = (s: State) => s.hand.count > 0 || isUnlocked(s, "origin");
/** Keys a Handover would pay right now (0 when it is not open). */
export function keysOnHandover(s: State): number {
    if (!handOpen(s)) return 0;
    const raw = HAND_TUNE.keysBase + treeCount(s) * HAND_TUNE.keysPerNode + Math.sqrt(Math.log10(1 + Math.max(0, s.origin))) * HAND_TUNE.keysPerOriginLog;
    return Math.floor(raw * (1 + handFx(s).keys) * bloomKeys(s));
}
/** Which prestige tree nodes a Handover keeps (Imprint, Deep imprint). */
export function handKeeps(s: State): string[] {
    const hf = handFx(s);
    if (!hf.keepEntry && !hf.keepUpper) return [];
    return s.tree.filter((id) => {
        const n = BY_ID.get(id);
        if (!n || n.form) return false;
        const slot = n.slot;
        return (hf.keepEntry && slot === 0) || (hf.keepUpper && (slot === 1 || slot === 3 || slot === 5));
    });
}
/**
 * Hand the node over. Wipes the run, AP, perks, the prestige tree, Drones, Mounted drives and the lab's Intel and stock;
 * keeps goals, secrets, logs, lifetime stats, lab research, learned Scripts, Keys and Firmware. Returns the Keys paid (0 = not allowed).
 */
export function handover(s: State, proto: ProtoId | null, note = "", proto2: ProtoId | null = null): number {
    const gain = keysOnHandover(s);
    if (gain < 1) return 0;
    const hf = handFx(s);
    const kept = handKeeps(s);
    const refund = Math.floor(treeSpent(s) * hf.apRefund);
    const perks = Object.fromEntries(Object.entries(s.perks).map(([k, v]) => [k, Math.floor(v * hf.perkKeep)])) as State["perks"];
    const text = note.replace(/\s+/g, " ").trim().slice(0, HAND_TUNE.noteMax);
    const hand: HandState = {
        ...s.hand,
        keys: s.hand.keys + gain,
        keysTotal: s.hand.keysTotal + gain,
        count: s.hand.count + 1,
        cycleAp: 0,
        cycleAt: s.life.secs,
        proto,
        proto2: hf.dual && proto2 !== proto ? proto2 : null,
        notes: text ? [...s.hand.notes, { n: s.hand.count + 1, text, at: s.at, proto }].slice(-50) : s.hand.notes,
    };
    const lab: LabState = { ...freshLab(), seen: s.lab.seen, nodes: s.lab.nodes, last: s.lab.last };
    const keep = { hand, lab, ap: refund, perks, tree: kept, treeLv: {}, ach: s.ach, achAt: s.achAt, logs: s.logs, armed: s.armed, watchdog: s.watchdog, dropAt: s.dropAt, autoArmed: s.autoArmed, auto: s.auto, dr: drOnAscend(s), life: { ...s.life }, started: s.started };
    const n = fresh(s.at);
    Object.assign(n, keep);
    Object.assign(s, n);
    s.rebootAt = s.life.secs;
    bootKit(s);
    return gain;
}
/** Switch protocol between Handovers (Operator's desk). */
export const canSwitchProto = (s: State) => handFx(s).anyAscend && s.hand.count > 0;
export function setProto(s: State, id: ProtoId | null, second = false): boolean {
    if (second) {
        if (!handFx(s).dual || id === s.hand.proto) return false;
        s.hand.proto2 = id;
        return true;
    }
    s.hand.proto = id;
    if (s.hand.proto2 === id) s.hand.proto2 = null;
    return true;
}
export function buyFw(s: State, id: string): boolean {
    const n = FW_BY.get(id);
    if (!n || s.hand.fw.includes(id) || !fwNodeOpen(s, n) || s.hand.keys < n.cost) return false;
    s.hand.keys -= n.cost;
    s.hand.fw = [...s.hand.fw, id];
    return true;
}
/** Firmware respec: free, refunds every Key. */
export function respecFw(s: State): number {
    const back = s.hand.fw.reduce((a, id) => a + (FW_BY.get(id)?.cost ?? 0), 0);
    s.hand.keys += back;
    s.hand.fw = [];
    if (!handFx(s).dual) s.hand.proto2 = null;
    return back;
}
export function fwTotals(s: State): [string, string][] {
    const f = handFx(s);
    const rows: [string, string][] = [];
    if (f.kitReboot) rows.push(["Ascend starts with", `${f.kitReboot} Reboots`]);
    if (f.kitProd) rows.push(["Starting producers", `${f.kitProd} on CU, SI, QZ, AE`]);
    if (f.afterglow) rows.push(["Opening Overclock", fmtTime(f.afterglow)]);
    if (f.unlockMul < 1) rows.push(["Materials open at", `${Math.round(f.unlockMul * 100)}%`]);
    if (f.rootPath < 1) rows.push(["Origin arc opens at", `${Math.round(f.unlockMul * f.rootPath * 100)}%`]);
    if (f.ascendAt < 1) rows.push(["Ascend needs", `${fmt(TUNE.ascendAether * f.ascendAt)} AE`]);
    if (f.preinstall) rows.push(["Preinstalled", "Watchdog, Orders, Forecast"]);
    if (f.keepEntry || f.keepUpper) rows.push(["Handover keeps", `${(f.keepEntry ? 5 : 0) + (f.keepUpper ? 15 : 0)} tree nodes`]);
    if (f.perkKeep) rows.push(["Perks kept", `${Math.round(f.perkKeep * 100)}%`]);
    if (f.labKeep) rows.push(["Ascend keeps", "Intel and payloads"]);
    if (f.droneKeep) rows.push(["Drone levels kept", `${Math.round(f.droneKeep * 100)}%`]);
    if (f.apRefund) rows.push(["Tree AP back", `${Math.round(f.apRefund * 100)}%`]);
    if (f.keys) rows.push(["Keys", `x${fmt(1 + f.keys)}`]);
    if (f.anyAscend) rows.push(["Protocol", "change any time"]);
    if (f.standby) rows.push(["Time away", `+${HAND_TUNE.standbyHours} h, Drones full speed`]);
    if (f.dual) rows.push(["Dual boot", "second protocol at half"]);
    if (f.lineage) rows.push(["Lineage", `x${fmt(handGlobal(s))} everything`]);
    return rows;
}
function parseHand(o: unknown): HandState {
    const b = freshHand();
    if (!o || typeof o !== "object") return b;
    const x = o as Partial<HandState>;
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const pid = (v: unknown): ProtoId | null => (PROTOS.some((p) => p.id === v) ? (v as ProtoId) : null);
    return {
        keys: Math.max(0, Math.floor(num(x.keys))),
        fw: Array.isArray(x.fw) ? [...new Set(x.fw.filter((id) => FW_BY.has(id)))] : [],
        proto: pid(x.proto),
        proto2: pid(x.proto2),
        count: Math.max(0, Math.floor(num(x.count))),
        keysTotal: Math.max(0, Math.floor(num(x.keysTotal))),
        cycleAp: Math.max(0, num(x.cycleAp)),
        cycleAt: Math.max(0, num(x.cycleAt)),
        notes: Array.isArray(x.notes) ? x.notes.filter((v) => v && typeof v.text === "string").map((v) => ({ n: Math.floor(num(v.n)), text: String(v.text).slice(0, HAND_TUNE.noteMax), at: num(v.at), proto: pid(v.proto) })).slice(-50) : [],
    };
}

// ---- saving
export function exportSave(s: State): string {
    return btoa(JSON.stringify({ ...s, at: Date.now() }));
}
/** Zone 25 was called Core (id "core") on integration for a few hours before it became Sunstone. Move those saves over. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renameCore(o: Record<string, any>) {
    if (!o || typeof o !== "object" || !("core" in o) || "sunstone" in o) return;
    const mv = (x: Record<string, unknown> | undefined) => { if (x && typeof x === "object" && "core" in x) { x.sunstone = x.core; delete x.core; } };
    mv(o); mv(o.prod); mv(o.bought); mv(o.rig?.lv); mv(o.rig?.re); mv(o.auto?.taught);
    for (const k of ["armed", "autoArmed", "mounts"]) if (Array.isArray(o[k])) o[k] = o[k].map((v: unknown) => (v === "core" ? "sunstone" : v));
    if (Array.isArray(o.ach)) o.ach = o.ach.map((v: unknown) => (v === "co1" ? "su1" : v));
    if (o.achAt && typeof o.achAt === "object" && "co1" in o.achAt) { o.achAt.su1 = o.achAt.co1; delete o.achAt.co1; }
    if (o.rig?.rwAim === "core") o.rig.rwAim = "sunstone";
}
export function parseSave(raw: string): State | null {
    try {
        const o = JSON.parse(raw.trim().startsWith("{") ? raw : atob(raw.trim()));
        renameCore(o);
        if (!o || o.v !== 1 || typeof o.bytes !== "number") return null;
        const base = fresh();
        const n = { ...base, ...o, prod: { ...base.prod, ...o.prod }, perks: { ...base.perks, ...o.perks }, life: { ...base.life, ...o.life }, bought: { ...base.bought, ...o.bought } } as State;
        for (const k of Object.keys(n.bought) as ButtonStat[]) if (!Array.isArray(n.bought[k]) || n.bought[k].length !== TIERS) n.bought[k] = Array(TIERS).fill(0);
        // saves from before arcs: what is built right now stands in for what was ever pressed (Reboot buttons are not counted, so tier 1 if any Reboot happened)
        if (!n.seen) {
            n.seen = {};
            for (const k of Object.keys(n.bought) as ButtonStat[]) n.seen[k] = n.bought[k].reduce((m, c, i) => m | (c > 0 ? 1 << i : 0), 0);
            if (n.life.reboots > 0) n.seen.reboot = (n.seen.reboot ?? 0) | 1;
        }
        if (!Array.isArray(n.tree)) n.tree = [];
        if (!n.treeLv || typeof n.treeLv !== "object") n.treeLv = {};
        if (!Number.isFinite(n.rebootAt)) n.rebootAt = 0;
        if (!Number.isFinite(n.frenzy)) n.frenzy = 0;
        if (!Array.isArray(n.mounts)) n.mounts = [];
        n.mounts = n.mounts.filter((m) => (MATS as readonly string[]).includes(m));
        if (!Array.isArray(n.autoArmed)) n.autoArmed = [];
        if (typeof n.watchdog !== "boolean") n.watchdog = true;
        if (!Number.isFinite(n.dropAt)) n.dropAt = 0;
        if (!Number.isFinite(n.runWins)) n.runWins = 0;
        n.lab = parseLab(o.lab);
        n.dr = parseDr(o.dr);
        n.ze = parseZe(o.ze);
        n.hand = parseHand(o.hand);
        const back = migrateTree(n);
        if (back > 0) n.treeRefund = (n.treeRefund ?? 0) + back;
        if (!Array.isArray(n.ach)) n.ach = [];
        if (!Array.isArray(n.logs)) n.logs = [];
        n.achAt = { ...(o.achAt && typeof o.achAt === "object" ? o.achAt : {}) };
        if (!Array.isArray(n.armed)) n.armed = [];
        for (const k of ["drones", "droneAcc"] as const) if (!Array.isArray(n[k]) || n[k].length !== TIERS || n[k].some((x: number) => !Number.isFinite(x))) n[k] = Array(TIERS).fill(0);
        for (const k of ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "nebula", "pulsars", "singularity", "engrams", "paradox", "origin", "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "sunstone", "ap"] as const) if (!Number.isFinite(n[k])) n[k] = base[k];
        return n;
    } catch {
        return null;
    }
}

/** Saved zone events, checked field by field (an event whose zone or kind is unknown is dropped). */
function parseZe(o: unknown): ZoneEvState | undefined {
    if (!o || typeof o !== "object") return undefined;
    const x = o as Partial<ZoneEvState>;
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    const kinds = Object.keys(ZE_TUNE.secs);
    const ids = STATS.map((st) => st.id as string);
    const act = (Array.isArray(x.act) ? x.act : [])
        .filter((e) => e && kinds.includes(e.kind) && ids.includes(e.zone) && num(e.left) > 0)
        .map((e) => ({ id: num(e.id), kind: e.kind, zone: e.zone, left: Math.min(num(e.left), ZE_TUNE.secs[e.kind]), total: ZE_TUNE.secs[e.kind], picked: !!e.picked }));
    return {
        act,
        wait: Math.max(0, Math.min(ZE_TUNE.gap[1], num(x.wait, ZE_TUNE.first))),
        seen: Math.max(0, Math.floor(num(x.seen))),
        kinds: Object.fromEntries(Object.entries(x.kinds ?? {}).filter(([k, v]) => kinds.includes(k) && num(v) > 0).map(([k, v]) => [k, Math.floor(num(v))])),
        last: ids.includes(x.last as string) ? x.last : undefined,
    };
}

/** A saved lab, checked field by field; anything odd falls back to a fresh lab. */
function parseLab(o: unknown): LabState {
    const b = freshLab();
    if (!o || typeof o !== "object") return b;
    const x = o as Partial<LabState>;
    const pid = (v: unknown): v is PayloadId => typeof v === "string" && PAY_BY.has(v as PayloadId);
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
    return {
        seen: !!x.seen,
        intel: Math.max(0, num(x.intel)),
        nodes: Array.isArray(x.nodes) ? [...new Set(x.nodes.filter((id) => LAB_BY.has(id)))] : [],
        queue: Array.isArray(x.queue) ? x.queue.filter((q) => q && pid(q.id)).map((q) => ({ id: q.id, left: Math.max(0, num(q.left)) })) : [],
        stock: Object.fromEntries(Object.entries(x.stock ?? {}).filter(([k, v]) => pid(k) && num(v) > 0).map(([k, v]) => [k, Math.min(LAB_TUNE.stockMax, Math.floor(num(v)))])),
        run: Array.isArray(x.run) ? x.run.filter((r) => r && pid(r.id) && num(r.left) > 0).map((r) => ({ id: r.id, left: Math.min(LAB_TUNE.maxRun, num(r.left)) })) : [],
        armed: Array.isArray(x.armed) ? [...new Set(x.armed.filter(pid))] : [],
        last: pid(x.last) ? x.last : null,
        dump: Math.min(LAB_TUNE.dumpSecs, Math.max(0, num(x.dump, LAB_TUNE.dumpSecs))),
    };
}

// ---- number formatting
const SUF = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
/** How big numbers print: short suffixes (1.2M), scientific (1.2e6) or engineering (1.2e6 in steps of three). A per-device setting. */
export type NumFmt = "short" | "sci" | "eng";
let numFmt: NumFmt = "short";
export function setNumFmt(f: NumFmt) { numFmt = f; }
export function getNumFmt(): NumFmt { return numFmt; }
export function fmt(n: number, digits = 2): string {
    if (!Number.isFinite(n)) return "∞";
    if (n < 0) return "-" + fmt(-n, digits);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(digits) : n < 100 && n % 1 ? n.toFixed(Math.max(0, digits - 1)) : Math.floor(n).toString();
    if (numFmt === "sci") return n.toExponential(2).replace("+", "");
    const e = Math.floor(Math.log10(n) / 3);
    if (numFmt === "eng") {
        const v = n / Math.pow(1000, e);
        return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + "e" + e * 3;
    }
    if (e >= SUF.length) return n.toExponential(2).replace("+", "");
    const v = n / Math.pow(1000, e);
    return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + SUF[e];
}
export function fmtTime(sec: number): string {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), x = sec % 60;
    return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`;
}

// ---- goals and secrets for the systems that came after the first eight tiers: Scripts, the Drone hangar, zone rigs, zone events,
// the Exploit Lab, the reactor core and Handover. Pushed here (after every table they read exists) so the base list stays untouched.
// Each one counts as a normal goal (TUNE.achBonus), and a full tier gives TUNE.tierBonus like the rest.
const ranSum = (s: State) => Object.values(s.auto?.ran ?? {}).reduce((a, n) => a + (n ?? 0), 0);
const rigSum = (s: State) => Object.values(s.rig?.lv ?? {}).reduce((a, n) => a + n, 0);
const bestRank = (s: State) => Math.max(0, ...POSTABLE.map((st) => zoneRank(s, st)));
/** Same rule as coreParts in core-look.ts: every structure is on the reactor core. */
const coreFull = (s: State) =>
    (s.life.reboots >= 1 || s.reboot > 0) && isUnlocked(s, "copper") && s.lab.seen && (s.drones.some((n) => n > 0) || Object.keys(s.dr?.svc ?? {}).length > 0) &&
    s.life.ascends >= 1 && (s.auto?.own.length ?? 0) > 0 && isUnlocked(s, "nebula") && isUnlocked(s, "engrams") && isUnlocked(s, "origin");
GOALS.push(
    // X  DAEMON: Scripts and Drones
    G("sc1", "Taught it", "Learn your first Script.", 10, "spark", 1, (s) => s.auto?.own.length ?? 0),
    G("sc6", "Full crontab", "Learn all six Scripts.", 10, "spark", 6, (s) => s.auto?.own.length ?? 0),
    G("sr1k", "Unattended", "Let Scripts run 1,000 actions.", 10, "spark", 1000, ranSum),
    G("dp1", "Sent out", "Post a Drone to a zone.", 10, "mult", 1, (s) => s.dr?.post.filter((x) => x).length ?? 0),
    G("dm3", "Regular", "Reach mastery rank III in a zone.", 10, "mult", 3, bestRank),
    G("dt18", "Full hangar", "Own every node in the Drone tree.", 10, "mult", DRONE_TREE.length, (s) => s.dr?.nodes.length ?? 0),
    // XI SUBSYSTEM: rigs, zone events, the lab, the core
    G("rg1", "Rigged", "Buy your first rig level.", 11, "copper", 1, rigSum),
    G("rg25", "Tuned", "Reach 25 rig levels in total.", 11, "copper", 25, rigSum),
    G("ze1", "Anomaly", "See a zone event.", 11, "alert", 1, (s) => s.ze?.seen ?? 0),
    G("lb1", "Live fire", "Deploy your first payload.", 11, "alert", 1, life("deployed")),
    G("lb18", "Full stack", "Research every Exploit Lab node.", 11, "alert", LAB.length, (s) => s.lab.nodes.length),
    G("cr9", "Fully bolted", "Get every structure onto the reactor core.", 11, "ascend", 1, (s) => (coreFull(s) ? 1 : 0)),
    // XII FIRMWARE: Handover
    G("hd1", "Handed over", "Hand the node over once.", 12, "origin", 1, (s) => s.hand?.count ?? 0),
    G("hd5", "Fifth operator", "Hand the node over 5 times.", 12, "origin", 5, (s) => s.hand?.count ?? 0),
    G("hk100", "Keyring", "Earn 100 Keys in total.", 12, "origin", 100, (s) => s.hand?.keysTotal ?? 0),
    G("hn3", "Notes to self", "Leave 3 handover notes.", 12, "origin", 3, (s) => s.hand?.notes.length ?? 0),
    G("fw9", "Flashed", "Own 9 Firmware nodes.", 12, "origin", 9, (s) => s.hand?.fw.length ?? 0),
    G("fw18", "Full image", "Own every Firmware node.", 12, "origin", FW.length, (s) => s.hand?.fw.length ?? 0),
);
SECRETS.push(
    { id: "x_rm", name: "Permission denied", clue: "Try to delete everything from the console.", how: "Ran `nf rm -rf /` in the console." },
    { id: "x_kill", name: "Kill signal", clue: "Tell a Drone it is done.", how: "Ran `nf kill` in the console." },
    { id: "x_zero", name: "Zero reply", clue: "Ping the node that came before this one.", how: "Ran `nf ping node-00` in the console." },
    { id: "x_hands", name: "Hands off", clue: "Let it decide when to leave.", how: "A Script ran an Ascend for you.", test: (s) => (s.auto?.ran.ascend ?? 0) >= 1 },
    { id: "x_edit", name: "Edit history", clue: "The root chamber lets you rewrite its neighbours. Keep going.", how: "Rewrote rigs 12 times.", test: (s) => (s.rig?.rw ?? 0) >= 12 },
);
