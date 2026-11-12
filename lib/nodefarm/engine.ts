// Node Farm engine: pure game rules, no React and no imports, so the pacing sim (scripts/nodefarm/sim.mjs) can run it
// directly in Node. Numbers are plain doubles; a full run stays far below 1e308.

/** Producer materials in chain order. Each is paid in the one before it (Copper in Bytes) and boosts that one in turn. */
export const MATS = ["copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "engrams", "paradox", "origin"] as const;
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
    { id: "engrams", name: "Engrams", short: "EG", role: "Recorded memory. Boosts Chrono, and Drones press faster.", pays: "chrono", color: "#e8b98a" },
    { id: "paradox", name: "Paradox", short: "PX", role: "Folded logic. Boosts Engrams, and Overclock hits harder.", pays: "engrams", color: "#dfe3f5" },
    { id: "origin", name: "Origin", short: "OR", role: "The first node. Boosts Paradox, and every Ascend pays more AP.", pays: "paradox", color: "#3dff6e" },
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
        engrams: { base: 30, ratio: 10, growth: 1.12 },
        paradox: { base: 15, ratio: 10, growth: 1.12 },
        origin: { base: 8, ratio: 10, growth: 1.12 },
    } as Record<string, { base: number; ratio: number; growth: number }>,
    // how much one press of tier k adds (Multipliers, or producers for materials)
    gainBase: { mult: 1, copper: 1, silicon: 1, quartz: 1, aether: 1, runes: 1, starglass: 1, voidsteel: 1, chrono: 1, engrams: 1, paradox: 1, origin: 1 } as Record<string, number>,
    gainRatio: 5,
    // reboot tier k: costs rebootBase * rebootRatio^k * rebootGrowth^R Multipliers, adds rebootGainRatio^k Reboots
    rebootBase: 100,
    rebootRatio: 4.5,
    rebootGrowth: 1.12,
    rebootGainRatio: 2.6,
    rebootStrength: 0.7, // each Reboot adds this much to Multiplier button gains
    perProducer: { copper: 0.05, silicon: 0.03, quartz: 0.016, aether: 0.008, runes: 0.0025, starglass: 0.0012, voidsteel: 0.0006, chrono: 0.0003, engrams: 0.00015, paradox: 0.00008, origin: 0.00004 } as Record<string, number>,
    boostK: { cuReboot: 0.09, cuBytes: 0.02, siCu: 0.2, qzSi: 0.2, aeQz: 0.2, ruAe: 0.12, sgRu: 0.12, vsSg: 0.12, chVs: 0.12, chAll: 0.03, egCh: 0.12, pxEg: 0.12, orPx: 0.12 },
    // the extras on the last three materials grow with log10 of the amount, so they cannot feed back into a runaway
    logK: { egDrone: 0.15, pxOc: 0.15, orAp: 0.1 },
    boostPow: 0.38,
    unlockAt: { copper: 1, silicon: 150, quartz: 300, aether: 500, runes: 150, starglass: 200, voidsteel: 250, chrono: 300, engrams: 350, paradox: 400, origin: 450 } as Record<string, number>, // copper: Reboots; the rest: amount of the stat below
    overclockMult: 6,
    overclockSecs: 20,
    offlineCapHours: 8,
    ascendAether: 400,
    apPerAether: 60, // AP = floor((aether / apPerAether)^apPow + (runes / apPer.runes)^apPow + ...)
    apPer: { runes: 90, starglass: 45, voidsteel: 27, chrono: 14, engrams: 1, paradox: 0.5, origin: 0.2 } as Record<string, number>,
    apPow: 0.3, // AP grows with amount^apPow; a low power stops Ascends from snowballing
    apBonus: 0.3,
    achBonus: 0.02,
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
    { id: "scanner", name: "Wide-band scanner", blurb: "Intrusions arrive 8% sooner per level.", max: 6, cost: (l) => 1 + l },
    { id: "auto", name: "Autoloader", blurb: "Auto-buys for you, one stat per level (Multipliers, then each material up the chain).", max: 12, cost: (l) => 3 + l * 2 },
    { id: "overclock", name: "Overclock coils", blurb: "Intrusion boosts last +5 s per level.", max: 6, cost: (l) => 2 + l * 2 },
    { id: "offline", name: "Standby cells", blurb: "Offline time banks +4 hours per level.", max: 6, cost: (l) => 2 + l * 2 },
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
    feature?: Feature;
}
/** Systems a node switches on. The UI checks them with `hasFeature`. */
export type Feature = "buymax" | "watchdog" | "forecast" | "deaddrop" | "orders" | "ghostline" | "crosstalk" | "duck";
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
type Row = [slot: number, id: string, kind: TreeKind, name: string, blurb: string, flavor: string, fx: TreeFx, cost?: number];
const ALL_MATS = (v: number) => Object.fromEntries(MATS.map((m) => [m, v])) as Record<MatId, number>;
const ARMS: Record<Branch, Row[]> = {
    signal: [
        [0, "linecode", "minor", "Line coding", "Bytes x2.", "Clean edges on every bit. The wire finally sounds like a wire.", { bytes: 1 }],
        [1, "batchjob", "minor", "Batch job", "Unlocks Buy max: one press buys as many as you can afford.", "Queue it up, walk away, come back to a receipt.", { feature: "buymax" }],
        [2, "echocancel", "minor", "Echo cancel", "Reboots keep 10% of your Multipliers.", "Most of the signal survives the restart. The rest was noise anyway.", { rebootKeep: 0.1 }],
        [3, "headstart", "minor", "Head start", "Every Ascend starts with 25 Reboots.", "The node remembers the way back. It just needs a push.", { kitReboot: 25 }],
        [4, "hotswap", "minor", "Hot swap", "Reboot power x2.", "Swapped the board while it was still warm. It did not notice.", { reboot: 1 }],
        [5, "watchdog", "notable", "Watchdog timer", "Auto-Reboot: Reboots for you at the best tier you can afford. Switch it in the Reboot zone.", "A timer that kicks the node when it stalls. The node has stopped stalling.", { feature: "watchdog" }],
        [6, "flatrate", "notable", "Flat rate", "Button prices climb 40% slower each time you buy.", "Renegotiated with the grid. They did not read the fine print.", { growth: 0.4 }],
        [7, "overdrive", "keystone", "Overdrive", "Everything x3.", "Past the red line the hum goes quiet. That is when it works hardest.", { global: 2 }],
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
    ],
    systems: [
        [0, "standby", "minor", "Standby plus", "Offline time banks +8 hours.", "Bigger cells, longer naps.", { offline: 8 }],
        [1, "carrier1", "minor", "Carrier I", "Each AP adds a third more to everything.", "Boosted the carrier. The points carry further.", { apEach: 1 / 3 }],
        [2, "forecast", "minor", "Forecast", "Every button shows how long until you can afford it.", "Every price comes with an arrival time now.", { feature: "forecast" }],
        [3, "carrier2", "notable", "Carrier II", "Each AP adds another third more.", "Louder carrier, same message, more of it lands.", { apEach: 1 / 3 }],
        [4, "ledger", "minor", "Ledger", "Each goal and secret gives +4% instead of +2%.", "Wrote down every win. The node reads the list at night.", { goals: 0.02 }],
        [5, "carrier3", "minor", "Carrier III", "Each AP adds another third more: twice the bonus with all three.", "The carrier is all you hear now.", { apEach: 1 / 3 }],
        [6, "deaddrop", "notable", "Dead drop", "A cache fills over 4 hours of real time, even while away. Open it for 1 hour of production.", "Someone leaves a box at the node. No note. Always the right size.", { feature: "deaddrop" }],
        [7, "coldstore", "keystone", "Cold storage", "AP from every Ascend x2.", "Packed the whole run in ice. It thaws worth twice as much.", { ap: 1 }],
    ],
    drones: [
        [0, "wake", "minor", "Wake routine", "Every Ascend starts with a level 1 Drone on every tier.", "They boot before I do.", { kitDrones: 1 }],
        [1, "sparecell", "minor", "Spare cells", "Drones go up to level 13 (was 10).", "Extra cells in every chassis. Heavier, happier.", { droneMax: 3 }],
        [2, "orders", "minor", "Standing orders", "New stats are armed for Drones the moment they open.", "Told them once. They remember.", { feature: "orders" }],
        [3, "overwatch", "minor", "Overwatch", "Drones press twice as fast.", "One watches, one presses, they swap every hour.", { drone: 1 }],
        [4, "bulkorder", "minor", "Bulk order", "Drones cost 50% less Aether.", "Bought them by the crate. The crate was cheaper than the box.", { droneCost: 0.5 }],
        [5, "graveyard", "notable", "Graveyard shift", "Drones work at full speed while you are away (was half).", "Nobody told them it was night.", { droneOff: 0.5 }],
        [6, "hivemem", "notable", "Hive memory", "Drones keep half their levels through every Ascend.", "They remember the old floor plan.", { droneKeep: 0.5 }],
        [7, "swarm", "keystone", "Swarm protocol", "Each Drone level adds +3% to everything.", "A hundred small hands, one big push.", { droneGlobal: 0.03 }],
    ],
    anomaly: [
        [0, "static", "minor", "Static", "Quick-time events come 30% more often.", "There is always someone on the line now.", { eventRate: 0.3 }],
        [1, "longfuse", "minor", "Long fuse", "Overclocks last twice as long.", "Slower burn, same bang.", { ocTime: 1 }],
        [2, "duck", "minor", "Rubber duck", "Does nothing. Listens, though.", "Explained the whole farm to it. Found two bugs.", { feature: "duck" }, 1],
        [3, "resonant", "minor", "Resonant noise", "Overclock is x12 instead of x6.", "Tuned the static until it hums in key.", { ocMult: 6 }],
        [4, "ghostline", "minor", "Ghost line", "Winning an event during an Overclock adds its time instead of restarting it.", "Two boosts, one wire. They queue politely.", { feature: "ghostline" }],
        [5, "echo", "notable", "Echo", "Winning an event has a 1 in 3 chance to bring the next one right away.", "Answered the knock and something knocked back.", { echo: 1 / 3 }],
        [6, "zeroday", "notable", "Zero-day", "One in five event wins also pays 10 minutes of production.", "An open door nobody else has found yet.", { zeroDay: 0.2 }],
        [7, "spike", "keystone", "Spike protocol", "Overclock x2 again, and every event win adds +2% to everything until the next Ascend.", "Every knock makes the node a little louder.", { ocX: 1, winBoost: 0.02 }],
    ],
};
const CHAINS: Record<string, [string, number, number]> = { carrier1: ["carrier", 1, 3], carrier2: ["carrier", 2, 3], carrier3: ["carrier", 3, 3], mount1: ["mount", 1, 2], mount2: ["mount", 2, 2] };
const ARM_ORDER: Branch[] = ["signal", "forge", "systems", "drones", "anomaly"];
function buildTree(): TreeNode[] {
    const out: TreeNode[] = [];
    ARM_ORDER.forEach((arm, ai) => {
        const th = -Math.PI / 2 + (ai * 2 * Math.PI) / ARM_ORDER.length;
        const c = Math.cos(th), sn = Math.sin(th);
        const ids: string[] = [];
        for (const [slot, id, kind, name, blurb, flavor, fx, price] of ARMS[arm]) {
            const [u, v] = SLOTS[slot];
            const ch = CHAINS[id];
            out.push({
                id, branch: arm, kind, name, blurb, flavor, fx,
                cost: Math.round((price ?? SLOT_COST[slot] * (kind === "notable" ? 1.3 : 1)) * TUNE.treeCost),
                links: slot === 0 ? ["core"] : [],
                x: +(u * c - v * sn).toFixed(3), y: +(u * sn + v * c).toFixed(3),
                ix: out.length, sprite: id,
                ...(slot === 0 ? { entry: true } : {}),
                ...(ch ? { chain: { id: ch[0], step: ch[1], of: ch[2] } } : {}),
            });
            ids[slot] = id;
        }
        SLOTS.forEach(([, , ls], slot) => ls.forEach((l) => {
            const A = out.find((n) => n.id === ids[slot])!, B = out.find((n) => n.id === ids[l])!;
            A.links.push(B.id);
            B.links.push(A.id);
        }));
    });
    return out;
}
export const TREE: TreeNode[] = buildTree();
const BY_ID = new Map(TREE.map((n) => [n.id, n]));
export const treeNode = (id: string) => BY_ID.get(id)!;
export const hasNode = (s: State, id: string) => s.tree.includes(id);
/** Buyable once it touches the core or an owned node. */
export const nodeOpen = (s: State, n: TreeNode) => n.links.some((l) => l === "core" || s.tree.includes(l));
/** Progressive reveal (Nate, 2026-11-12): owned and buyable nodes are shown; one step past a shown node is fog (a
 *  silhouette at its real size, no name or cost); everything further out is hidden. */
/** Admin mode: show every node, fog or not (components/nodefarm/admin.tsx). */
export const adminFlags = { reveal: false };
export function nodeVis(s: State, n: TreeNode): NodeVis {
    if (adminFlags.reveal) return "shown";
    if (s.tree.includes(n.id) || nodeOpen(s, n)) return "shown";
    return n.links.some((l) => l !== "core" && nodeOpen(s, BY_ID.get(l)!)) ? "fog" : "hidden";
}
export function buyNode(s: State, id: string): boolean {
    const n = BY_ID.get(id);
    if (!n || s.tree.includes(id) || !nodeOpen(s, n) || s.ap < n.cost) return false;
    s.ap -= n.cost;
    s.tree.push(id);
    return true;
}
/** Take every node back and refund the AP spent on it. Costs nothing. Returns the AP refunded. */
export function respec(s: State): number {
    let back = 0;
    for (const id of s.tree) back += BY_ID.get(id)?.cost ?? 0;
    s.ap += back;
    s.tree = [];
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
/** Drop node ids that are not in this tree and give their AP back. Returns the AP refunded. */
export function migrateTree(s: State): number {
    let back = 0;
    const keep: string[] = [];
    for (const id of s.tree) {
        if (BY_ID.has(id)) { if (!keep.includes(id)) keep.push(id); }
        else back += LEGACY_COST[id] ?? 0;
    }
    s.tree = keep;
    s.ap += back;
    return back;
}
export const hasFeature = (s: State, f: Feature) => s.tree.some((id) => BY_ID.get(id)?.fx.feature === f);
/** AP spent on owned nodes and perks. With TUNE.apBonusFromEarned the AP bonus counts this too, so spending never lowers it. */
export function apSpent(s: State): number {
    let n = 0;
    for (const id of s.tree) n += BY_ID.get(id)?.cost ?? 0;
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
    const named: Record<Feature, string> = { buymax: "Buy max", watchdog: "Watchdog timer", forecast: "Forecast", deaddrop: "Dead drop", orders: "Standing orders", ghostline: "Ghost line", crosstalk: "Cross-talk", duck: "Rubber duck" };
    if (f.features.length) rows.push(["Systems", f.features.map((k) => named[k]).join(", ")]);
    return rows;
}

const mulIn = (a: number, b?: number) => (b ? (1 + a) * (1 + b) - 1 : a);
/** Everything the owned tree nodes give. Boosts named "x(1 + this)" stack by multiplying. Cached per tree array and length. */
const FX_CACHE = new WeakMap<string[], { n: number; v: ReturnType<typeof treeFxRaw> }>();
export function treeFx(s: State) {
    const c = FX_CACHE.get(s.tree);
    if (c && c.n === s.tree.length) return c.v;
    const v = treeFxRaw(s);
    FX_CACHE.set(s.tree, { n: s.tree.length, v });
    return v;
}
function treeFxRaw(s: State) {
    const o = {
        bytes: 0, global: 0, reboot: 0, multGain: 0, discount: 1, start: 0, offline: 0, overclock: 0, ocMult: 0, ap: 0, goals: 0, drone: 0, droneMax: 0, droneCost: 1, droneOff: 0,
        mats: {} as Record<string, number>,
        apEach: 0, growth: 0, rebootKeep: 0, unlockMul: 1, kitReboot: 0, kitProd: {} as Record<string, number>, kitDrones: 0, droneKeep: 0, droneGlobal: 0, mounts: 0,
        eventRate: 0, ocTime: 0, ocX: 0, winBoost: 0, zeroDay: 0, echo: 0, features: [] as Feature[],
    };
    for (const id of s.tree) {
        const f = BY_ID.get(id)?.fx;
        if (!f) continue;
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
    engrams: number;
    paradox: number;
    origin: number;
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
    // lifetime counters (survive Ascend)
    life: { bytes: number; taps: number; reboots: number; ascends: number; intrusions: number; secs: number; presses: number; capped: number; peakBps: number; apTotal: number; intel: number; compiled: number; deployed: number };
    overclock: number; // seconds left
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
        engrams: 0,
        paradox: 0,
        origin: 0,
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
        mounts: [],
        watchdog: true,
        dropAt: 0,
        runWins: 0,
        autoArmed: [],
        life: { bytes: 0, taps: 0, reboots: 0, ascends: 0, intrusions: 0, secs: 0, presses: 0, capped: 0, peakBps: 0, apTotal: 0, intel: 0, compiled: 0, deployed: 0 },
        lab: freshLab(),
        overclock: 0,
    };
}

const boost = (amount: number, k: number) => 1 + k * Math.pow(Math.max(0, amount), TUNE.boostPow);

export interface Derived {
    global: number;
    bytesPerSec: number;
    rebootStrength: number;
    multGainMult: number;
    rates: Record<MatId, number>;
    offlineCap: number; // seconds
    boosts: { cuReboot: number; cuBytes: number; siCu: number; qzSi: number; aeQz: number; ruAe: number; sgRu: number; vsSg: number; chVs: number; chAll: number; egCh: number; pxEg: number; orPx: number };
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
        chAll: boost(s.chrono, k.chAll),
        egCh: boost(s.engrams, k.egCh),
        pxEg: boost(s.paradox, k.pxEg),
        orPx: boost(s.origin, k.orPx),
    };
    const tf = treeFx(s);
    const lb = labBuffs(s);
    const droneLv = s.drones.reduce((a, b) => a + b, 0);
    const global = (1 + s.perks.power * 0.15) * (1 + tf.global) * apGlobal(s) * (1 + s.ach.length * (TUNE.achBonus + tf.goals)) * (1 + tiersDone(s) * TUNE.tierBonus)
        * (1 + droneLv * tf.droneGlobal) * (1 + s.runWins * tf.winBoost) * boosts.chAll * (s.overclock > 0 ? overclockMult(s) : 1) * lb.global;
    const rebootStrength = TUNE.rebootStrength * boosts.cuReboot * (1 + tf.reboot);
    const multGainMult = (1 + rebootStrength * s.reboot) * (1 + tf.multGain) * lb.mult;
    const bytesPerSec = s.mult * boosts.cuBytes * global * (1 + tf.bytes) * lb.bytes;
    // each material is boosted by the one after it in the chain
    const boostedBy: Record<MatId, number> = { copper: boosts.siCu, silicon: boosts.qzSi, quartz: boosts.aeQz, aether: boosts.ruAe, runes: boosts.sgRu, starglass: boosts.vsSg, voidsteel: boosts.chVs, chrono: boosts.egCh, engrams: boosts.pxEg, paradox: boosts.orPx, origin: 1 };
    // Cross-talk: each material is also boosted by the one two steps up the chain, at the weaker late-chain strength
    if (tf.features.includes("crosstalk")) MATS.forEach((m, i) => { const up = MATS[i + 2]; if (up) boostedBy[m] *= boost(s[up], TUNE.boostK.ruAe); });
    const rates = {} as Record<MatId, number>;
    for (const m of MATS) rates[m] = s.prod[m] * TUNE.perProducer[m] * boostedBy[m] * (1 + (tf.mats[m] ?? 0)) * global * (FORGE_MATS.includes(m) ? lb.forge : 1);
    return { global, bytesPerSec, rebootStrength, multGainMult, rates, offlineCap: Math.max(1, TUNE.offlineCapHours + s.perks.offline * 4 + tf.offline) * 3600, boosts };
}

export const gainFor = (stat: ButtonStat, tier: number) => TUNE.gainBase[stat] * Math.pow(TUNE.gainRatio, tier);

/** What pressing one button costs and gives right now. */
export function button(s: State, stat: ButtonStat, tier: number) {
    if (stat === "reboot") {
        const tf = treeFx(s);
        const cost = TUNE.rebootBase * Math.pow(TUNE.rebootRatio, tier) * Math.pow(TUNE.rebootGrowth, s.reboot * (1 - tf.growth)) * tf.discount;
        return { cost, gain: Math.max(1, Math.round(Math.pow(TUNE.rebootGainRatio, tier))), pays: "mult" as StatId };
    }
    const c = TUNE.cost[stat];
    const tf = treeFx(s);
    const cost = c.base * Math.pow(c.ratio, tier) * Math.pow(c.growth, s.bought[stat][tier] * (1 - tf.growth)) * tf.discount;
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
    const i = MATS.indexOf(id as MatId);
    const below = MATS[i - 1];
    // after your first Ascend a stat opens at a quarter of the usual amount
    const need = TUNE.unlockAt[id] * treeFx(s).unlockMul;
    return s.prod[id as MatId] > 0 || amount(s, below) >= need || (s.life.ascends > 0 && s.life.reboots >= TUNE.unlockAt.copper && amount(s, below) >= need / 4);
}

/** Press a button. Returns false when it can't be afforded. A Reboot press also resets Bytes and Multipliers. */
export function press(s: State, stat: ButtonStat, tier: number): boolean {
    const b = button(s, stat, tier);
    if (amount(s, b.pays) < b.cost) return false;
    if (stat === "reboot") {
        // Logic bomb (Exploit Lab): an armed charge multiplies this Reboot
        const bomb = s.lab.armed.indexOf("logicbomb");
        const gain = bomb >= 0 ? Math.round(b.gain * (1 + payloadV(s, payload("logicbomb")))) : b.gain;
        if (bomb >= 0) s.lab.armed.splice(bomb, 1);
        // a crash dump: the Reboot banks the Intel buffer (it refills over LAB_TUNE.dumpSecs)
        labLump(s, s.lab.dump);
        s.lab.dump = 0;
        s.reboot += gain;
        s.life.presses += 1;
        s.life.reboots += gain;
        s.mult = Math.max(1, s.mult * treeFx(s).rebootKeep);
        s.bought.mult.fill(0);
        s.bytes = derive(s).bytesPerSec * (10 * s.perks.start + treeFx(s).start);
        return true;
    }
    (s[b.pays] as number) = amount(s, b.pays) - b.cost;
    s.life.presses += 1;
    s.bought[stat][tier] += 1;
    if (stat === "mult") s.mult += b.gain;
    else s.prod[stat] += b.gain;
    return true;
}

export const droneMax = (s: State) => TUNE.drone.max + treeFx(s).droneMax;
export const droneCost = (s: State, tier: number) => TUNE.drone.base * Math.pow(TUNE.drone.ratio, tier) * Math.pow(TUNE.drone.growth, s.drones[tier]) * treeFx(s).droneCost;
export const dronesOpen = (s: State) => s.aether > 0 || s.prod.aether > 0 || s.life.ascends > 0;
export function buyDrone(s: State, tier: number): boolean {
    const c = droneCost(s, tier);
    if (!dronesOpen(s) || s.drones[tier] >= droneMax(s) || s.aether < c) return false;
    s.aether -= c;
    s.drones[tier] += 1;
    return true;
}
/** Engrams make Drones press faster, Paradox makes Overclock stronger, Origin adds AP. Log-scale so none of them can run away. */
const logBoost = (amount: number, k: number) => 1 + k * Math.log10(1 + Math.max(0, amount));
export const droneBoost = (s: State) => logBoost(s.engrams, TUNE.logK.egDrone);
export const paradoxOc = (s: State) => logBoost(s.paradox, TUNE.logK.pxOc);
export const originAp = (s: State) => logBoost(s.origin, TUNE.logK.orAp);
export const droneRate = (s: State, tier: number) => s.drones[tier] * TUNE.drone.rate * (1 + treeFx(s).drone) * labBuffs(s).drone * droneBoost(s);
export function toggleArm(s: State, stat: string) {
    s.armed = s.armed.includes(stat) ? s.armed.filter((x) => x !== stat) : [...s.armed, stat];
}
/** Let the Drones press for dt seconds. eff scales their speed (time away runs slower). Returns presses made. */
export function droneStep(s: State, dt: number, eff = 1): number {
    if (!s.armed.length) return 0;
    let made = 0;
    for (let k = 0; k < TIERS; k++) {
        if (s.drones[k] <= 0) continue;
        s.droneAcc[k] = Math.min(s.droneAcc[k] + droneRate(s, k) * dt * eff, TUNE.drone.burst);
        let n = Math.floor(s.droneAcc[k]);
        if (n < 1) continue;
        s.droneAcc[k] -= n;
        for (const st of STATS) {
            if (st.id === "bytes" || st.id === "reboot" || !s.armed.includes(st.id) || !isUnlocked(s, st.id)) continue;
            for (let i = 0; i < n; i++) {
                if (!press(s, st.id as ButtonStat, k)) break;
                made++;
            }
        }
    }
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
    s.life.secs += dt;
    if (d.bytesPerSec > s.life.peakBps) s.life.peakBps = d.bytesPerSec;
    labStep(s, dt, d.bytesPerSec);
    droneStep(s, dt, eff);
    watchdogStep(s);
    autoArm(s);
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
    return { stacked, zero, echo, intel };
}
/** How much sooner events come (Wide-band scanner perk plus Static), as a fraction off the gap. */
export const eventHaste = (s: State) => 1 - Math.max(0.3, (1 - s.perks.scanner * 0.08) * (1 - treeFx(s).eventRate));

// ---- Watchdog timer (auto-Reboot) and the Dead drop
/** Press the best affordable Reboot once you hold TUNE.watchdogReserve times its price. Returns the tier pressed, or -1. */
export function watchdogStep(s: State): number {
    if (!s.watchdog || !hasFeature(s, "watchdog") || !isUnlocked(s, "reboot")) return -1;
    for (let k = TIERS - 1; k >= 0; k--) {
        const b = button(s, "reboot", k);
        if (s.mult >= b.cost * TUNE.watchdogReserve) return press(s, "reboot", k) ? k : -1;
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
/** Buy max: press one button as many times as the balance allows (Batch job). Returns the number bought. */
export function pressMax(s: State, stat: Exclude<ButtonStat, "reboot">, tier: number, cap = 1000): number {
    let n = 0;
    while (n < cap && press(s, stat, tier)) n++;
    return n;
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
    if (s.aether < TUNE.ascendAether) return 0;
    let raw = Math.pow(s.aether / TUNE.apPerAether, TUNE.apPow);
    for (const [m, per] of Object.entries(TUNE.apPer)) raw += Math.pow(s[m as MatId] / per, TUNE.apPow);
    let gain = raw * (1 + treeFx(s).ap) * originAp(s) * (s.lab.armed.includes("zeroclick") ? 1 + payload("zeroclick").v : 1);
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
    const lab: LabState = { ...s.lab, intel: 0, run: [], armed: s.lab.armed.filter((x) => x !== "zeroclick"), dump: LAB_TUNE.dumpSecs };
    const keep = { lab, ap: s.ap + gain, perks: s.perks, ach: s.ach, achAt: s.achAt, logs: s.logs, tree: s.tree, armed: s.armed, mounts: s.mounts, watchdog: s.watchdog, dropAt: s.dropAt, autoArmed: s.autoArmed, life: { ...s.life, ascends: s.life.ascends + 1, apTotal: s.life.apTotal + gain }, started: s.started };
    const n = fresh(s.at);
    Object.assign(n, keep);
    Object.assign(s, n);
    // starting kits and what the tree carries over
    s.reboot = tf.kitReboot;
    for (const [m, v] of Object.entries(tf.kitProd)) s.prod[m as MatId] += v;
    for (const [m, v] of Object.entries(keptProd)) s.prod[m as MatId] = Math.max(s.prod[m as MatId], v);
    s.drones = keptDrones;
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

/** Catch up for time away. Production only; nothing is bought for you. Returns what was gained. */
export function offline(s: State, seconds: number) {
    const cap = derive(s).offlineCap;
    const secs = Math.min(Math.max(0, seconds), cap);
    const before = Object.fromEntries((["bytes", ...MATS] as const).map((k) => [k, s[k]])) as Record<"bytes" | MatId, number>;
    const steps = Math.min(600, Math.max(1, Math.ceil(secs / 20)));
    const dt = secs / steps;
    const oc = s.overclock;
    s.overclock = 0; // an intrusion boost doesn't carry through time away
    const pressesBefore = s.life.presses;
    for (let i = 0; i < steps; i++) tick(s, dt, Math.min(1, TUNE.drone.offline + treeFx(s).droneOff));
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
export const GOAL_TIERS = 8;
export const TIER_NAMES = ["", "Access", "Operator", "Admin", "Root", "Kernel", "Deep", "Zero", "Source"];
const G = (id: string, name: string, hint: string, tier: number, icon: Goal["icon"], target: number, cur: (s: State) => number): Goal => ({ id, name, hint, tier, icon, cur, target });
const life = (k: keyof State["life"]) => (s: State) => s.life[k];
export const GOALS: Goal[] = [
    // I  ACCESS
    G("tap10", "First contact", "Press 10 buttons.", 1, "spark", 10, life("presses")),
    G("b1k", "Packet storm", "Earn 1,000 Bytes.", 1, "bytes", 1e3, life("bytes")),
    G("m100", "Stacked", "Hold 100 Multipliers.", 1, "mult", 100, (s) => s.mult),
    G("r1", "Cold boot", "Reboot once.", 1, "reboot", 1, life("reboots")),
    G("cu1", "Trace lines", "Mine your first Copper.", 1, "copper", 1e-9, (s) => s.copper),
    G("int1", "Counter-hack", "Win an intrusion.", 1, "alert", 1, life("intrusions")),
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
    G("int25", "Watchdog", "Win 25 intrusions.", 3, "alert", 25, life("intrusions")),
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
    G("tr18", "Whole tree", "Own every node in the prestige tree.", 7, "ascend", TREE.length, (s) => s.tree.length),
    // VIII SOURCE: the last three zones, where the node's past turns up
    G("eg1", "Deja vu", "Record your first Engram.", 8, "engrams", 1e-9, (s) => s.engrams),
    G("eg1k", "Total recall", "Hold 1,000 Engrams.", 8, "engrams", 1e3, (s) => s.engrams),
    G("px1", "Both at once", "Fold your first Paradox.", 8, "paradox", 1e-9, (s) => s.paradox),
    G("px1k", "Strange loop", "Hold 1,000 Paradox.", 8, "paradox", 1e3, (s) => s.paradox),
    G("or1", "Node zero", "Reach the first Origin.", 8, "origin", 1e-9, (s) => s.origin),
    G("asc30", "Thirtieth floor", "Ascend 30 times.", 8, "ascend", 30, life("ascends")),
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
        [0, "rx_sniffer", "minor", "Packet sniffer", "Recipe: Packet sniffer. Bytes x2 for 10 minutes.", "Listen first. The wire tells you everything if you let it talk.", { recipe: "sniffer" }],
        [1, "rx_worm", "minor", "Worm", "Recipe: Worm. Multiplier buttons add x2 for 10 minutes.", "It copies itself into every amp on the stack. The amps don't mind.", { recipe: "worm" }],
        [2, "rx_logicbomb", "minor", "Logic bomb", "Recipe: Logic bomb. Your next Reboot gives x3 Reboots.", "Set it, forget it, and let the next restart do the work.", { recipe: "logicbomb" }],
        [3, "rx_obfuscate", "notable", "Obfuscation", "Exploits buffs are 50% stronger.", "Same code, uglier. Nothing on the line recognises it anymore.", { potency: "exploits" }],
        [4, "rx_ransom", "minor", "Ransomware", "Recipe: Ransomware. Pays out 10 minutes of Bytes, Copper, Silicon and Quartz at once.", "Lock it, then charge the node for its own key. The node always pays.", { recipe: "ransom" }],
        [5, "rx_kernel", "keystone", "Kernel exploit", "Recipe: Kernel exploit. Everything x2 for 5 minutes.", "Ring zero. For five minutes nothing on this node says no.", { recipe: "kernel" }],
    ],
    malware: [
        [0, "rx_rootkit", "minor", "Rootkit", "Recipe: Rootkit. Copper, Silicon and Quartz x1.75 for 15 minutes.", "Dig in under the forge. It runs hotter when it can't see you.", { recipe: "rootkit" }],
        [1, "rx_trojan", "minor", "Trojan", "Recipe: Trojan. Starts an Overclock right now.", "Looks like a gift. Is a gift, mostly.", { recipe: "trojan" }],
        [2, "rx_botnet", "minor", "Botnet", "Recipe: Botnet. Drones press twice as fast for 10 minutes.", "Lent the Drones a few thousand extra hands. Nobody asked whose.", { recipe: "botnet" }],
        [3, "rx_mutate", "notable", "Mutation", "Malware buffs last twice as long.", "Every copy a little different. The scanner gave up counting.", { longer: "malware" }],
        [4, "rx_zeroclick", "minor", "Zero-click", "Recipe: Zero-click. Your next Ascend pays x1.25 AP.", "No prompt, no warning, more points on the way up.", { recipe: "zeroclick" }],
        [5, "rx_polymorph", "keystone", "Polymorph", "Recipe: Polymorph. Doubles the time left on every running payload.", "It wears whatever is already running and makes it last.", { recipe: "polymorph" }],
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
    return LAB_TUNE.intelK * Math.pow(Math.log10(1 + Math.max(0, bytesPerSec)), LAB_TUNE.intelPow) * (1 + labFx(s).intel);
}
/** What compiling one payload costs right now. */
export function payloadCost(s: State, p: PayloadDef, d: Derived = derive(s)) {
    const rate = p.mat.stat === "bytes" ? d.bytesPerSec : (d.rates as Record<string, number>)[p.mat.stat] ?? 0;
    const base = intelRate(s, d.bytesPerSec) / (1 + labFx(s).intel);
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

// ---- saving
export function exportSave(s: State): string {
    return btoa(JSON.stringify({ ...s, at: Date.now() }));
}
export function parseSave(raw: string): State | null {
    try {
        const o = JSON.parse(raw.trim().startsWith("{") ? raw : atob(raw.trim()));
        if (!o || o.v !== 1 || typeof o.bytes !== "number") return null;
        const base = fresh();
        const n = { ...base, ...o, prod: { ...base.prod, ...o.prod }, perks: { ...base.perks, ...o.perks }, life: { ...base.life, ...o.life }, bought: { ...base.bought, ...o.bought } } as State;
        for (const k of Object.keys(n.bought) as ButtonStat[]) if (!Array.isArray(n.bought[k]) || n.bought[k].length !== TIERS) n.bought[k] = Array(TIERS).fill(0);
        if (!Array.isArray(n.tree)) n.tree = [];
        if (!Array.isArray(n.mounts)) n.mounts = [];
        n.mounts = n.mounts.filter((m) => (MATS as readonly string[]).includes(m));
        if (!Array.isArray(n.autoArmed)) n.autoArmed = [];
        if (typeof n.watchdog !== "boolean") n.watchdog = true;
        if (!Number.isFinite(n.dropAt)) n.dropAt = 0;
        if (!Number.isFinite(n.runWins)) n.runWins = 0;
        n.lab = parseLab(o.lab);
        const back = migrateTree(n);
        if (back > 0) n.treeRefund = (n.treeRefund ?? 0) + back;
        if (!Array.isArray(n.ach)) n.ach = [];
        if (!Array.isArray(n.logs)) n.logs = [];
        n.achAt = { ...(o.achAt && typeof o.achAt === "object" ? o.achAt : {}) };
        if (!Array.isArray(n.armed)) n.armed = [];
        for (const k of ["drones", "droneAcc"] as const) if (!Array.isArray(n[k]) || n[k].length !== TIERS || n[k].some((x: number) => !Number.isFinite(x))) n[k] = Array(TIERS).fill(0);
        for (const k of ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "engrams", "paradox", "origin", "ap"] as const) if (!Number.isFinite(n[k])) n[k] = base[k];
        return n;
    } catch {
        return null;
    }
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
