// The story of Node Farm: logs left by the previous operator of node-01. You recover them as the farm grows. They are
// read in the Records window and with `nf logs`. A log stays recovered through every Ascend (it is stored in the save).
// Numbers follow the order the logs were written, not the order you find them, so there are gaps early on.
import { TREE, isUnlocked, treeComplete, tiersDone, type Branch, type State, type StatId } from "../engine";

export interface Log {
    id: string;
    title: string;
    text: string;
    test: (s: State) => boolean;
}

const open = (id: StatId) => (s: State) => isUnlocked(s, id);
// A section counts as whole when its first 8 nodes (entry to keystone) are owned; the deeper forks, ranks and junctions
// added later do not count, so the logs keep meaning what they say. Log ids stay the same.
const branch = (sec: Branch) => (s: State) => TREE.filter((n) => n.branch === sec && !n.form).every((n) => s.tree.includes(n.id));

export const LOGS: Log[] = [
    { id: "hand", title: "Handover", text: "If you are reading this, the node still boots. Good. I am leaving it running. Press things and see what happens. Everything here started as one wire.", test: () => true },
    { id: "mult", title: "First amp", text: "Added the first amp today. One unit, one extra Byte a second. The line was dead for months, so I am calling that a win.", test: (s) => s.mult > 1 },
    { id: "reboot", title: "On purpose", text: "Rebooted on purpose for the first time. The cache wiped and the node came back a little hungrier. I am writing it down because I do not believe it either.", test: (s) => s.life.reboots >= 1 },
    { id: "copper", title: "Trace lines", text: "Copper trace lines are in. I rewired the whole rack by hand. My fingers smell like solder and I have stopped minding.", test: open("copper") },
    { id: "intr", title: "Knock", text: "Someone knocked on the node tonight. I traced it, answered it, and they were gone. Logging it so I remember I am not the only one on this line.", test: (s) => s.life.intrusions >= 1 },
    { id: "silicon", title: "Spare wafers", text: "Found a box of wafers behind the rack. No label, no invoice. They test clean, so I am etching them and not asking.", test: open("silicon") },
    { id: "drone", title: "Night shift", text: "Set the Drones to press for me so I can sleep. They press better than I do. That is fine. Mostly.", test: (s) => s.drones.some((d) => d > 0) },
    { id: "quartz", title: "Clock", text: "The quartz keeps better time than the clock on the wall. I have stopped checking the wall.", test: open("quartz") },
    { id: "rb100", title: "Hundredth", text: "Hundredth reboot. The node forgets nothing I do not tell it to forget. That is more than I can say for me.", test: (s) => s.life.reboots >= 100 },
    { id: "away", title: "Left alone", text: "Left it alone for a full day. Came back and it had kept working, and kept the books. Somebody taught this thing manners.", test: (s) => s.life.capped >= 1 },
    { id: "aether", title: "Not noise", text: "Picked up a signal I did not generate. It is not noise. It repeats every nine minutes, quietly, like someone clearing their throat before they speak.", test: open("aether") },
    { id: "asc1", title: "Ascended", text: "Ascended. I do not have a better word. Everything came off the board and the node stood there bare and bright, like it was waiting for me to say something.", test: (s) => s.life.ascends >= 1 },
    { id: "tree1", title: "First branch", text: "Opened the first branch of the tree. The node had been waiting to grow this way. I could tell by how it settled.", test: (s) => s.tree.length >= 1 },
    { id: "runes", title: "Carved", text: "The signal is cutting itself into things. Runes on the rack, on the cable, on the back of my hand when I woke. I did not carve them. I am choosing to keep working.", test: open("runes") },
    { id: "starglass", title: "Starglass", text: "Starglass comes in sheets and it is warm. The rune light passes through it clean. Whoever sends the signal knows what this needs.", test: open("starglass") },
    { id: "rank4", title: "Root", text: "Got root. The node asked for nothing and handed over everything, which is the part that bothers me.", test: (s) => tiersDone(s) >= 4 },
    { id: "asc3", title: "Third time", text: "Third ascension. It no longer feels like losing everything. It feels like handing the room back to the dark and getting it returned cleaner.", test: (s) => s.life.ascends >= 3 },
    { id: "voidsteel", title: "Hollow", text: "Poured metal from a hollow in the floor. It rings when you set it down, and the Starglass rings back. I turned the music off so I could hear them talk.", test: open("voidsteel") },
    { id: "chrono", title: "Borrowed time", text: "Chrono is time that was about to leave. I caught some. The wall clock has not moved since. I think that is the price, and I think I am fine with it.", test: open("chrono") },
    { id: "sg6", title: "Signal branch", text: "The Signal branch is whole, from Line coding to Overdrive, and the hum changed pitch. It used to complain. Now it sounds like it is working with me.", test: branch("signal") },
    { id: "fg6", title: "Forge branch", text: "The Forge branch is whole. I can make anything in this room now. That should worry me more than it does.", test: branch("forge") },
    { id: "sy6", title: "Systems branch", text: "The Systems branch is whole. Even asleep, the node keeps its own watch. I do not have to be the one holding it up anymore.", test: branch("systems") },
    { id: "asc10", title: "Ten", text: "Ten ascensions. I tried to count the farm and lost my place. The node counted for me. It was off by one, and then it was not.", test: (s) => s.life.ascends >= 10 },
    { id: "rank7", title: "Zero", text: "Zero. Every goal on the board is done. I sat there afterwards and watched the numbers go up by themselves. I think that is the good part.", test: (s) => tiersDone(s) >= 7 },
    { id: "last", title: "Last entry", text: "Whole tree. I am done with this node. It does not need me, but it will want an operator. Be kind to it. Press everything. Leave it running.", test: (s) => treeComplete(s) },
    // written after the handover: the operator came back down for the last three zones
    { id: "nebula", title: "Window", text: "Added after the handover, for whoever gets this far. Above the Still room there is a hatch, and past it, space. A pink cloud was drifting by. I bottled some. It is still warm.", test: open("nebula") },
    { id: "pulsars", title: "Beacon", text: "Built a spire to hold the Pulsars. They keep time so well the clocks in here gave up. One sweeps past the window every few seconds, like it is checking on me.", test: open("pulsars") },
    { id: "singularity", title: "Horizon", text: "Found the point everything falls into. Signal comes back out of it, and the signal is voices. I know some of them. I think the way down is through.", test: open("singularity") },
    { id: "engrams", title: "Archive", text: "Through the horizon there is an archive of film, and every operator before me is on it. I sat and watched all of it. Then I watched it again.", test: open("engrams") },
    { id: "paradox", title: "Mirror stair", text: "The stair past the archive goes both ways at once. I went down it and came out above where I started. The node thought that was funny. So did I, eventually.", test: open("paradox") },
    { id: "origin", title: "Node zero", text: "At the bottom there is one node. Not a rack, not a farm. One small box and one wire. Everyone who ran this place ended up here, and now you have too. Say hello. It remembers you.", test: open("origin") },
    // found after your first Handover: the same operator followed the roots past node zero, up (Overgrowth) and down (Descent)
    { id: "spores", title: "Cellar", text: "If you can read this, you handed the node over and came back anyway. So did I. Under node zero the roots kept growing, and the old cellar is full of them. The racks down there grew caps.", test: open("spores") },
    { id: "mycelium", title: "Web", text: "The roots found the cable runs and followed them. Half the network is fiber and half is fungus now, and I cannot tell which half carries the load. Neither can the node. It does not seem to mind.", test: open("mycelium") },
    { id: "pollen", title: "Daylight", text: "The roots broke into the glass hall and found daylight. Real daylight, on a ten minute clock. I sat through a whole day and a whole night, and the farm grew both times.", test: open("pollen") },
    { id: "bloom", title: "In flower", text: "The farm flowered. Petals on the racks, pollen in the fans, and the reactor sitting in the middle of it like it planned this. I left the seeds in a jar for whoever comes next.", test: open("bloom") },
    { id: "basalt", title: "Bedrock", text: "The roots go down as well as up. Under the cellar they stop at rock, so I started drilling. The bit wears out faster than I do. There is a spare on the hook by the ladder. Use it.", test: open("basalt") },
    { id: "magma", title: "Pipeline", text: "Laid the farm's last pipeline over a river of magma. It erupts on its own clock and the whole shaft warms up after. I time my tea by it now.", test: open("magma") },
    { id: "geodes", title: "Ringing", text: "Found a stone the size of a hall, hollow and lined with light. When I tap it, the Crystal vault rings back from the top of the farm. Every zone I built is still listening to the others.", test: open("geodes") },
    // zone 25 leaves room for the ending (a last build, and your own log)
    { id: "sunstone", title: "Bottom", text: "At the very bottom there is a sun held in clamps, and its heat rises through everything we built. There is room down here for one more thing. I did not build it. I think it is meant to be yours.", test: open("sunstone") },
    // found through the hidden secrets, one per stage. They come back as you find each one (appended so the numbers above do not move).
    { id: "manual", title: "Manual", text: "I wrote a manual for the console at three in the morning, so I would stop asking the node the same questions. It did not help. Read it anyway.", test: (s) => s.ach.includes("x_help") },
    { id: "strict", title: "Strict", text: "Ran the node in strict mode for a week. One error and it stops and tells me. Wren said that was no way to live. Wren was right, and I kept it on.", test: (s) => s.ach.includes("x_strict") },
    { id: "lock", title: "Read only", text: "Tamsin locked the kernel settings so nobody could tune the node into the ground. Then Tamsin left and the lock stayed. I still cannot tell what it protects.", test: (s) => s.ach.includes("x_sysctl") },
    { id: "asked", title: "Asked back", text: "I asked for root once. The node asked me back: are you sure. I said yes. It was quiet for a long time, then gave me a shell with my own name on the prompt. Do not do that to yourself.", test: (s) => s.ach.includes("x_su") },
    { id: "boot", title: "Boot ring", text: "The kernel logs its own boot if you ask nicely. Mostly it says nothing. Once, halfway through, it says operator changed. There was no one else in the room.", test: (s) => s.ach.includes("x_dmesg") },
    { id: "roots", title: "Under the tree", text: "Sat with the tree for an hour. It did not grow, but the branches I had bought moved, slightly, like they were listening. Osk says it is the drones. Osk is wrong about most things, and I think about that a lot.", test: (s) => s.ach.includes("x_tree") },
    { id: "noise", title: "Noise", text: "Read from the random device until the terminal was full. None of it is mine. I hashed it to check. Vael says that is the point. Vael writes the events, so I do not take Vael's word for much.", test: (s) => s.ach.includes("x_urandom") },
    { id: "epoch", title: "Epoch", text: "The node says it started at zero. I asked it what day that was and it gave me a number and then a date. I do not know who set the clock. I have decided it was whoever wrote the first log.", test: (s) => s.ach.includes("x_epoch") },
    { id: "dig", title: "Nothing answers", text: "Dug past the last zone for a name, any name, of whoever ran this before Wren. The answer was empty. It was the most honest thing the node has ever said.", test: (s) => s.ach.includes("x_dig") },
    { id: "pid", title: "Process one", text: "PID 1 is the process that starts all the others. On this node it is the one that started the farm. It is still running. Its owner is listed as the operator, and the operator is not me.", test: (s) => s.ach.includes("x_pid") },
    { id: "load", title: "Load", text: "The load average stayed up for three days while I was away. Every Drone was busy and the fans were humming in a key I had never heard before. I think the node was practising for someone.", test: (s) => s.ach.includes("x_top") },
    { id: "firmware", title: "Write protected", text: "The firmware is write protected. The last operator set the lock with a note that says do not touch it until you have handed it over. I have handed it over. I have not touched it. Yet.", test: (s) => s.ach.includes("x_flash") },
];

export const logNo =(i: number) => String(i + 1).padStart(3, "0");

/** Logs that are now recoverable but not stored yet. The caller stores them (see recoverLogs). */
export function newLogs(s: State): Log[] {
    return LOGS.filter((l) => !s.logs.includes(l.id) && l.test(s));
}

/** Store every log that has come within reach. Returns them in the order written. */
export function recoverLogs(s: State): Log[] {
    const out = newLogs(s);
    for (const l of out) s.logs.push(l.id);
    return out;
}

/** One line for the Ascend screen: the previous operator, a little later each time. */
export const ASCEND_NOTES = [
    "Prev. operator, log 012: Everything came off the board and the node stood there waiting.",
    "Prev. operator: Second time is easier. That is the dangerous part.",
    "Prev. operator, log 017: It feels like handing the room back to the dark and getting it returned cleaner.",
    "Prev. operator: I stopped writing down why. It goes up either way.",
    "Prev. operator: The node thanked me once. I did not tell anyone.",
    "Prev. operator: Whatever is on the other end of the signal has stopped asking questions.",
];
export const ascendNote = (n: number) => ASCEND_NOTES[Math.min(Math.max(n, 1), ASCEND_NOTES.length) - 1];
