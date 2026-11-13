// Node Farm codex: one short entry per system, hidden until the player has reached it. Pure data and rules, no React.
// Numbers come from the engine's own tuning tables (TUNE, DRONE_TUNE, ZE_TUNE, ...), so a rebalance changes the text with it.
// Terms follow the game: zones, Reboot, Ascend, Handover, events (every event is a zone event now; the ones on a
// zone panel), Drone hangar, Standby window, payload (never "recipe"). Add an entry by appending to ENTRIES.
import {
    DRONE_TREE, DRONE_TUNE, FW, GOALS, GOAL_TIERS, HAND_TUNE, LAB, LAB_TUNE, MATS, PAYLOADS, PERKS, PROTOS, REBOOT_UNLOCK, STATS, TIERS, TREE, TUNE, ZE_TUNE,
    dronesOpen, handSeen, isUnlocked, labOpen, statDef, type State, type StatId,
} from "./engine";
import { ARCS, zoneNo } from "./arcs";
import { LORE } from "./lore";
import { NF_KEY_GROUPS, NF_KEYS_NOTE } from "./keys";
import { chOpen } from "./stress";
import { LOGS } from "./story";
import { EVENT_TUNE } from "./events";
import { RIGS, RIG_TUNE } from "./rigs";
import { SCRIPTS, SCRIPT_TUNE, schedOpen } from "./scripts";

/** A piece of an entry: a paragraph, dotted `key ..... value` lines, a bulleted list with bold lead words, or a dim aside. */
export type Block = { p: string } | { rows: [string, string][] } | { list: [string, string][] } | { note: string };
export type CodexGroup = "basics" | "zones" | "systems" | "prestige" | "ref";
/** A window or menu the entry can jump to. */
export type CodexOpen = "map" | "goals" | "records" | "ascend" | "handover" | "menu" | "tree" | "lab";

export interface CodexEntry {
    id: string;
    group: CodexGroup;
    title: string;
    /** has the player reached this system? Entries that answer false are not shown at all. */
    gate: (s: State) => boolean;
    /** key or place that opens the system, shown under the title */
    where?: string;
    open?: { win: CodexOpen; label: string };
    body: (s: State) => Block[];
}

export const GROUPS: { id: CodexGroup; label: string }[] = [
    { id: "basics", label: "Basics" },
    { id: "zones", label: "Zones" },
    { id: "systems", label: "Systems" },
    { id: "prestige", label: "Prestige" },
    { id: "ref", label: "Reference" },
];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mins = (secs: number) => `${Math.round(secs / 60)} min`;
const unlockedMats = (s: State) => MATS.filter((m) => isUnlocked(s, m));
const treeSeen = (s: State) => s.life.ascends > 0 || s.ap > 0 || s.tree.length > 0;
const zone = (id: StatId) => `${String(zoneNo(id)).padStart(2, "0")} ${LORE[id].zone}`;

export const ENTRIES: CodexEntry[] = [
    // ------------------------------------------------------------------ basics
    {
        id: "buttons", group: "basics", title: "Buttons", gate: () => true,
        body: () => [
            { p: "Every zone has six buy buttons, one per tier. A press spends the stat that pays for that zone and adds to it. There is nothing to tap. Buying is what moves the numbers." },
            {
                rows: [
                    ["Tier gains", Array.from({ length: TIERS }, (_, k) => `+${Math.pow(TUNE.gainRatio, k)}`).join(" ")],
                    ["Tier price", `about ${TUNE.cost.copper.ratio}x the tier before (${TUNE.cost.mult.ratio}x on Multipliers)`],
                    ["Each buy", `that button costs ${pct(TUNE.cost.copper.growth - 1)} more (${pct(TUNE.cost.mult.growth - 1)} on Multipliers)`],
                ],
            },
            { p: "Lower tiers give more for the same spend. Higher tiers save presses once you have plenty. Hold a button to keep buying. Keys 1 to 6 press that tier on the zone nearest the middle of the screen." },
            { note: "Hover a button, or tap it on a phone, to see its price, what it adds and how long until you can afford it." },
        ],
    },
    {
        id: "chain", group: "basics", title: "The chain", gate: () => true,
        body: (s) => [
            { p: "Zones run in a chain. Each one is paid in the stat before it, and each material boosts the stat that pays it." },
            { rows: STATS.filter((x) => x.pays && isUnlocked(s, x.id)).map((x): [string, string] => [x.name, `paid in ${statDef(x.pays!).name}`]) },
            { p: "Because boosts run down the chain, the deepest zone you own is what makes everything above it faster." },
        ],
        open: { win: "map", label: "Open the Map" },
    },
    {
        id: "bytes", group: "basics", title: "Bytes and Multipliers", gate: () => true,
        body: () => [
            { p: "Bytes per second is the number everything else feeds. Each Multiplier you own adds one Byte per second before any boost." },
            { p: `Multiplier buttons add +1 up to +${Math.pow(TUNE.gainRatio, TIERS - 1)}. Their strength grows with every Reboot you hold: about ${pct(TUNE.rebootStrength)} more per Reboot, and more with Copper.` },
            { p: "Bytes pay for Multipliers and for Copper. Past that, boosts from the chain and your global bonus do the work." },
        ],
    },
    {
        id: "next", group: "basics", title: "Next step and Map", gate: () => true, where: "key G, P, M",
        body: () => [
            { p: "The strip under the HUD names the one thing to do now and why, with a meter and a time estimate. It changes as you progress." },
            {
                list: [
                    ["Show me (G)", "opens the zone and makes the right button glow."],
                    ["P", "presses the glowing button. Hold it to keep buying. It never repeats a Reboot."],
                    ["Map (M)", "shows the whole chain, what is open and what each locked zone needs."],
                ],
            },
            { p: "When the strip scrolls out of view, a slim readout with Bytes, the rate and the next step sticks under the site bar." },
        ],
        open: { win: "map", label: "Open the Map" },
    },
    {
        id: "zones", group: "basics", title: "Zones and arcs", gate: () => true,
        body: (s) => {
            const live = ARCS.filter((a) => a.zones.some((z) => isUnlocked(s, z as StatId)));
            return [
                { p: "The board groups zones into arcs. Click a zone header to fold the zone, or an arc header to fold the whole arc. A locked zone shows what opens it. Only the first locked zone is drawn in full; the rest wait under one BEYOND line." },
                { rows: live.map((a): [string, string] => [a.name, a.zones.map((z) => String(zoneNo(z as StatId)).padStart(2, "0")).join(" ")]) },
                { p: "Each zone panel draws a scene that grows from stage 0 to stage 7 as you afford more of its buttons and buy more units. Paying for the top button always means stage 7. A stage never drops until you Ascend." },
            ];
        },
    },
    {
        id: "goals", group: "basics", title: "Goals and secrets", gate: () => true, where: "key O",
        body: () => [
            { p: `${GOAL_TIERS} tiers of goals, ${GOALS.length} in all. Each goal or secret gives +${pct(TUNE.achBonus)} to everything, and a finished tier gives +${pct(TUNE.tierBonus)}. They are kept through Ascend.` },
            { p: "Secrets show as ???? with a clue. Some are found by playing a certain way and some by trying things in the console." },
        ],
        open: { win: "goals", label: "Open Goals" },
    },
    {
        id: "records", group: "basics", title: "Records and operator logs", gate: () => true, where: "key L",
        body: () => [
            { p: "Records lists this run, your materials, lifetime totals and progress." },
            { p: `Operator logs are notes from whoever ran node-01 before you. There are ${LOGS.length}. Each one decrypts when you reach something (a zone, a number of Reboots, a finished tree section) and is kept through Ascend. Read them in Records or with nf logs.` },
            { p: "The terminal feed also drops a line every 20 to 30 seconds: a note, a hint, or a message from an earlier operator." },
        ],
        open: { win: "records", label: "Open Records" },
    },
    {
        id: "core", group: "basics", title: "Reactor core", gate: () => true,
        body: () => [
            { p: "The outer arc shows progress to your cheapest Reboot, and the core pulses on every press." },
            { p: "It wears the color of the newest zone you have bought in, turns magenta during an Overclock, and bolts on a new structure each time a system opens: clamps at your first Reboot, a Copper socket, lattice masts for the Exploit Lab, drone docks, a code orbit for scripts, gyro rings, a corona at Engrams." },
            { note: "After your first Ascend, nf core chroma cycles every color you have opened." },
        ],
    },
    // ------------------------------------------------------------------ zones
    {
        id: "reboot", group: "zones", title: "Reboot", gate: (s) => isUnlocked(s, "reboot"), where: "zone 03",
        body: () => [
            { p: `A Reboot is paid in Multipliers and resets Bytes and Multipliers. In return every Reboot you hold makes Multiplier buttons hit harder.` },
            {
                rows: [
                    ["Opens at", `${REBOOT_UNLOCK.bytes} Bytes earned or ${REBOOT_UNLOCK.mult} Multipliers`],
                    ["Tier gains", Array.from({ length: TIERS }, (_, k) => String(Math.max(1, Math.round(Math.pow(TUNE.rebootGainRatio, k))))).join(" ")],
                    ["Price", `${TUNE.rebootBase} Multipliers, x${TUNE.rebootRatio} per tier, ${pct(TUNE.rebootGrowth - 1)} more per Reboot held`],
                ],
            },
            { p: `Your first Reboot opens Copper. Reboots are never bought by Drones.` },
        ],
    },
    {
        id: "materials", group: "zones", title: "Materials", gate: (s) => isUnlocked(s, "copper"), where: "zones 04 to 07",
        body: () => [
            { p: "Copper, Silicon, Quartz and Aether are producers. A press adds producers, and each producer mines its stat every second. Copper is paid in Bytes; each later material is paid in the one before it." },
            {
                rows: (["copper", "silicon", "quartz", "aether"] as const).map((m): [string, string] => [statDef(m).name, `${TUNE.perProducer[m]}/s per producer`]),
            },
            { p: `Silicon opens at ${TUNE.unlockAt.silicon} Copper, Quartz at ${TUNE.unlockAt.quartz} Silicon and Aether at ${TUNE.unlockAt.aether} Quartz. After your first Ascend each opens at a quarter of that.` },
            { p: `${TUNE.ascendAether} Aether opens Ascend.` },
        ],
    },
    {
        id: "deep", group: "zones", title: "Deep materials", gate: (s) => isUnlocked(s, "runes"), where: "zones 08 to 11",
        body: () => [
            { p: `Runes, Starglass, Voidsteel and Chrono open at ${TUNE.unlockAt.runes} Aether, ${TUNE.unlockAt.starglass} Runes, ${TUNE.unlockAt.voidsteel} Starglass and ${TUNE.unlockAt.chrono} Voidsteel (a quarter of that after your first Ascend).` },
            { p: "They follow the same rules as the first four, and each boosts the zone below it. Chrono also adds a little to everything. All of them add to the AP an Ascend pays." },
        ],
    },
    {
        id: "space", group: "zones", title: "Deep space and the Origin arc", gate: (s) => isUnlocked(s, "nebula"), where: "zones 12 on",
        body: (s) => {
            const mats = unlockedMats(s).filter((m) => MATS.indexOf(m) >= MATS.indexOf("nebula"));
            return [
                { p: "Past Chrono the zones follow the deep-space arc and then the Origin arc. Same rules as the deep materials. Their extras grow with the log of what you hold, so they cannot run away." },
                { list: mats.map((m): [string, string] => [zone(m), statDef(m).role]) },
            ];
        },
    },
    // ------------------------------------------------------------------ systems
    {
        id: "rigs", group: "systems", title: "Zone rigs", gate: () => true, where: "inside each zone",
        body: (s) => [
            { p: `Every zone has one rig: a meter, one rule and a level track. A level costs minutes of that zone's own output (${RIG_TUNE.minutes.slice(0, 5).join(", ")}), and a rig stops at level ${RIG_TUNE.baseCap}. Levels stay through Ascend; meters, charges and clocks reset with the run.` },
            { list: RIGS.filter((r) => isUnlocked(s, r.zone)).map((r): [string, string] => [`${String(zoneNo(r.zone)).padStart(2, "0")} ${r.name}`, r.rule]) },
        ],
    },
    {
        id: "zoneevents", group: "systems", title: "Zone events", gate: (s) => s.life.secs >= ZE_TUNE.first || (s.ze?.seen ?? 0) > 0,
        where: "a card, every 11 to 19 minutes",
        body: () => [
            { p: `About every ${ZE_TUNE.gap[0] / 60} to ${ZE_TUNE.gap[1] / 60} minutes of play, one open zone gets a short event. Nothing takes stock from you and nothing needs a reflex. The Wide-band scanner perk and the Anomaly nodes shorten the wait.` },
            {
                list: [
                    ["Surge", `the zone's output x${ZE_TUNE.surge} for ${mins(ZE_TUNE.secs.surge)}.`],
                    ["Clearance", `its buttons cost ${pct(1 - ZE_TUNE.clearance)} less for ${mins(ZE_TUNE.secs.clearance)}. Not on Bytes.`],
                    ["Resonance", `the zone and the one below it x${ZE_TUNE.resonance} for ${mins(ZE_TUNE.secs.resonance)}.`],
                    ["Rich vein", `x${ZE_TUNE.vein} for ${mins(ZE_TUNE.secs.vein)}, or Mine it now for ${mins(ZE_TUNE.mine)} of output at once.`],
                    ["Fault", `output halved for ${mins(ZE_TUNE.secs.fault)}. Patch it for ${ZE_TUNE.patch} s of Bytes, or wait it out. Starts after ${mins(ZE_TUNE.faultFrom)} of play.`],
                    ["Rogue process", "pick one of three offers, all at one rarity. Opens at 5 Multipliers plus Reboots."],
                    ["Cold storage", `hold to decrypt ${EVENT_TUNE.vaultRows} rows and keep every row you open.`],
                ],
            },
            { p: `Mining a vein, patching a fault, picking a Rogue offer and cashing out Cold storage (from ${pct(EVENT_TUNE.winAt)} of the rows) count as a win: you get an Overclock (everything x${TUNE.overclockMult} for ${TUNE.overclockSecs} s, longer with Overclock coils) and the Anomaly nodes fire. The two card events also pay a loot roll. Letting an event run costs nothing.` },
            { p: "Plain events close on their own after 7 seconds. A vein, a fault, a Rogue process or Cold storage waits for your answer, or for Decide later. Time away only runs the clock down; it never starts one." },
        ],
    },
    {
        id: "lab", group: "systems", title: "Exploit Lab", gate: (s) => labOpen(s), where: "key R",
        body: () => [
            { p: "A second currency, Intel, and a small research tree that run beside Bytes. It opens when Silicon does." },
            {
                list: [
                    ["Intel", `trickles in from your Bytes per second. Each Reboot banks a crash dump (up to ${LAB_TUNE.dumpSecs} s of trickle) and each zone event win pays ${LAB_TUNE.eventSecs} s.`],
                    ["Research", `${LAB.length} nodes in three arms (Exploits, Malware, Infra). Instant, paid in Intel. Most unlock a payload; Infra upgrades the lab.`],
                    ["Compile", `a payload takes time, the queue holds ${LAB_TUNE.queue}, and it keeps running while you are away. Cancelling refunds in full. Stock holds ${LAB_TUNE.stockMax} of each.`],
                    ["Deploy", `buffs last 5 to 15 minutes in ${LAB_TUNE.slots} slots; a charge arms for your next Reboot or Ascend; an instant acts at once.`],
                ],
            },
            { p: `${PAYLOADS.length} payloads in all. Ascend keeps research and stock, and resets Intel, running buffs and the dump.` },
        ],
        open: { win: "lab", label: "Open the lab" },
    },
    {
        id: "drones", group: "systems", title: "Drones", gate: (s) => dronesOpen(s), where: "the Drone hangar zone",
        body: () => [
            { p: `One Drone per button tier, T1 to T6, bought with Aether up to level ${TUNE.drone.max}. Each level presses its tier's button ${TUNE.drone.rate} times a second on every stat you have armed.` },
            {
                rows: [
                    ["Price", `${TUNE.drone.base} Aether, x${TUNE.drone.ratio} per tier, x${TUNE.drone.growth} per level`],
                    ["Armed", "switch on each zone. Reboots are never automated"],
                    ["Away", `${pct(TUNE.drone.offline)} speed`],
                ],
            },
            { p: "Drones reset on Ascend. Which stats are armed is kept." },
        ],
    },
    {
        id: "hangar", group: "systems", title: "Drone hangar", gate: (s) => s.drones.some((l) => l > 0) || s.dr.nodes.length > 0,
        where: "the Drone hangar zone",
        body: () => [
            { p: "Drones improve in three ways." },
            {
                list: [
                    ["Postings", `post a Drone to one zone. It presses only there, ${DRONE_TUNE.postX}x as fast. Every press it attempts adds service to that zone.`],
                    ["Mastery", `service sets a zone's rank I to V (at ${DRONE_TUNE.rankAt.map((n) => n.toLocaleString("en-US")).join(", ")}). Each rank multiplies that zone's output, up to x${DRONE_TUNE.rankX[5]}. Kept forever.`],
                    ["Parts and mods", `every attempted press salvages ${DRONE_TUNE.partK} Parts. Parts buy Servo (+${pct(DRONE_TUNE.servoEach)} speed), Uplink (+1x posting speed) and Reach (also presses the tier below), up to level ${DRONE_TUNE.modMax}. They reset on Ascend.`],
                    ["Drone tree", `${DRONE_TREE.length} nodes in three arms, bought with Cores (ranks earned minus nodes owned). Respec is free.`],
                ],
            },
        ],
    },
    {
        id: "scripts", group: "systems", title: "Scripts", gate: (s) => schedOpen(s), where: "the Scripts zone",
        body: (s) => [
            { p: "Scripts are learned by doing. The scheduler watches what you press, and once you have done something enough times it offers to do it for you. A new script starts stopped." },
            { list: SCRIPTS.map((x): [string, string] => [x.file, `learned after you ${x.teach(SCRIPT_TUNE.learn[x.id]).replace(/ more/, "").replace(/^(\w)/, (m) => m.toLowerCase()).replace(/\.$/, "")}.`]) },
            {
                list: [
                    ["buy.sh", `presses the highest tier it may afford while keeping a reserve of ${SCRIPT_TUNE.keep.map((k) => `x${k}`).join(", ")} the price. It only uses tiers you pressed by hand ${SCRIPT_TUNE.teachTier} times on that stat. One press per stat every ${SCRIPT_TUNE.buyCycle[0]} s, faster after ${SCRIPT_TUNE.buyVer[1]} and ${SCRIPT_TUNE.buyVer[2].toLocaleString("en-US")} buys. Drones stay the fast option.`],
                    ["reboot.sh", `Reboots once your Multipliers reach ${SCRIPT_TUNE.rebootX.map((k) => `x${k}`).join(", ")} the price.`],
                    ["ascend.sh", `Ascends when the AP on offer beats your last Ascend by x${SCRIPT_TUNE.ascX[0]} to x${SCRIPT_TUNE.ascX[SCRIPT_TUNE.ascX.length - 1]}. Never in a run under ${mins(SCRIPT_TUNE.ascMinSecs)}, and only while the game is open.`],
                ],
            },
            { note: `Scripts keep running while you are away, except ascend.sh. ${s.auto?.own.length ?? 0} of ${SCRIPTS.length} learned. nf cron lists them.` },
        ],
    },
    // ------------------------------------------------------------------ prestige
    {
        id: "ascend", group: "prestige", title: "Ascend", gate: (s) => isUnlocked(s, "aether") || s.life.ascends > 0, where: "key A",
        body: () => [
            { p: `Ascend opens at ${TUNE.ascendAether} Aether. Hold the button for ${1.2} seconds. It resets the run for Ascension Points (AP).` },
            {
                rows: [
                    ["AP paid", `grows with the amount of Aether and every deeper material you hold, to the power ${TUNE.apPow}`],
                    ["Each AP held", `+${pct(TUNE.apBonus)} to everything (counts less past ${TUNE.apSoft} AP)`],
                    ["Spent AP", "stops counting toward that bonus until you respec"],
                ],
            },
            { p: "It wipes Bytes, Multipliers, Reboots, materials, Drone levels, and the lab's Intel and running buffs. It keeps goals, secrets, logs, lifetime stats, perks, tree nodes, Drone postings and mastery, lab research and stock, scripts and rig levels. Zones open at a quarter of their usual amount from then on." },
            { list: PERKS.map((x): [string, string] => [x.name, x.blurb]) },
        ],
        open: { win: "ascend", label: "Open Ascend" },
    },
    {
        id: "tree", group: "prestige", title: "Prestige tree", gate: treeSeen, where: "key T",
        body: () => [
            { p: `${TREE.length} nodes in five sections around the Hub, bought with AP and kept through every Ascend. A node opens when it touches the Hub or a node you own.` },
            {
                list: [
                    ["Keystones", "sit at the end of each section and are plain boosts."],
                    ["Junctions", "sit between two sections and need both neighbors."],
                    ["Forks", "offer two nodes; you own one. Swapping is free."],
                    ["Ranked", "tips you can buy up to 5 times."],
                ],
            },
            { p: "Some nodes switch on whole systems: the Watchdog timer (Reboots for you), Forecast, the Dead drop (a payout that fills over 4 real hours, even while you are away), Standing orders (auto-arm for Drones) and Mounted drives (keep producers through Ascend)." },
            { note: "Respec is free and refunds all your AP." },
        ],
        open: { win: "tree", label: "Open the tree" },
    },
    {
        id: "handover", group: "prestige", title: "Handover", gate: (s) => handSeen(s), where: "key H",
        body: () => [
            { p: `A Handover is the reset past Ascend. It opens once Origin is producing. Hold the button for ${1.6} seconds. A backup is kept first.` },
            {
                rows: [
                    ["Wipes", "the run, AP, perks, the prestige tree and its ranks, Drones, Mounted drives, lab Intel, stock, queue and buffs"],
                    ["Keeps", "goals, secrets, logs, lifetime stats, lab research, Keys, Firmware and your notes"],
                    ["Pays", "Keys, from the tree nodes you own and how much Origin you hold. A whole tree pays about 13 to 20"],
                    ["After", `Ascends pay AP x(1 + ${HAND_TUNE.apPerHand} per Handover done)`],
                ],
            },
            { p: `You can leave a note of up to ${HAND_TUNE.noteMax} characters for whoever runs the node next.` },
        ],
        open: { win: "handover", label: "Open Handover" },
    },
    {
        id: "firmware", group: "prestige", title: "Firmware and protocols", gate: (s) => s.hand.count > 0 || s.hand.keys > 0, where: "key K",
        body: () => [
            { p: `Firmware is a tree of ${FW.length} nodes in three arms (Boot, Memory, Relay), bought with Keys at ${HAND_TUNE.nodeCost[0]} to ${HAND_TUNE.nodeCost[HAND_TUNE.nodeCost.length - 1]} each. It is kept forever and respec is free.` },
            { p: "At each Handover you pick one protocol, named for an earlier operator. Dual boot runs a second one at half strength. The Operator's desk lets you switch any time." },
            { list: PROTOS.map((x): [string, string] => [`${x.op}, ${x.name}`, x.blurb]) },
        ],
    },
    // ------------------------------------------------------------------ reference
    {
        id: "saves", group: "ref", title: "Standby and saves", gate: () => true, where: "key S",
        body: () => [
            { p: `While you are away the game keeps running for up to ${TUNE.offlineCapHours} hours (Standby cells add 4 hours a level). Drones work at ${pct(TUNE.drone.offline)} speed, the lab keeps compiling and scripts keep working. Come back after more than a minute and the standby report shows what was banked. Nothing is bought for you except by Drones and scripts.` },
            { p: "The game saves to this browser every 5 seconds. Menu has a save code, Download file and Open file, plus a backup written before an import, a wipe or a restore. If a second tab opens the same save, that tab stops saving and says so." },
            { note: `Menu also holds sound, the reactor hum, events, calm motion, number format and volume. Full screen is F.` },
        ],
        open: { win: "menu", label: "Open Menu" },
    },
    {
        id: "keys", group: "ref", title: "Hotkeys", gate: () => true,
        body: (s) => {
            const gate = { tree: treeSeen(s), lab: labOpen(s), hand: handSeen(s), stress: chOpen(s) };
            const rows: [string, string][] = NF_KEY_GROUPS.flatMap((g) => g.rows).filter((r) => !r.needs || gate[r.needs]).map((r) => [r.keys.join(" / "), r.label]);
            return [{ rows }, { note: NF_KEYS_NOTE + " Press ? for the same list in a sheet." }];
        },
    },
    {
        id: "console", group: "ref", title: "Console", gate: () => true, where: "backtick, or Ctrl or Cmd + J",
        body: (s) => {
            const rows: [string, string][] = [
                ["nf", "a summary"],
                ["nf stats", "records"],
                ["nf goals", "goal progress"],
                ["nf secrets", "secrets and their clues"],
                ["nf logs [n]", "operator logs, or one by number"],
                ["nf news", "a line from the terminal feed"],
                ["nf archive [name]", "what you have found of each earlier operator"],
                ["nf codex [name]", "this guide"],
                ["nf fs [on|off]", "full screen"],
                ["nf core [zone|chroma|name]", "the reactor core's colors"],
                ["nf open", "scroll to the game"],
                ...(labOpen(s) ? ([["nf lab", "Exploit Lab"]] as [string, string][]) : []),
                ...(schedOpen(s) ? ([["nf cron", "scripts"]] as [string, string][]) : []),
                ...(handSeen(s) ? ([["nf handover", "Handover"]] as [string, string][]) : []),
            ];
            return [{ p: "Type these in the naOS console. They work with the game open, or from your saved game." }, { rows }];
        },
    },
];

export const ENTRY_BY = new Map(ENTRIES.map((e) => [e.id, e]));

export const unlocked = (s: State): CodexEntry[] => ENTRIES.filter((e) => e.gate(s));

// ---- which entries the player has opened (per browser, not in the save)
const KEY = "nf-codex-v1";
let seenIds: Set<string> | null = null;
export function codexSeen(): Set<string> {
    if (!seenIds) {
        seenIds = new Set();
        try { for (const k of JSON.parse(localStorage.getItem(KEY) || "[]")) if (typeof k === "string") seenIds.add(k); } catch {}
    }
    return seenIds;
}
export function markCodexSeen(id: string) {
    const set = codexSeen();
    if (set.has(id)) return;
    set.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
}
export const codexNew = (s: State): CodexEntry[] => { const seen = codexSeen(); return unlocked(s).filter((e) => !seen.has(e.id)); };
