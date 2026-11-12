// The story of Node Farm: logs left by the previous operator of node-01. You recover them as the farm grows. They are
// read in the Records window and with `nf logs`. A log stays recovered through every Ascend (it is stored in the save).
// Numbers follow the order the logs were written, not the order you find them, so there are gaps early on.
import { TREE, isUnlocked, tiersDone, type State, type StatId } from "./engine";

export interface Log {
    id: string;
    title: string;
    text: string;
    test: (s: State) => boolean;
}

const open = (id: StatId) => (s: State) => isUnlocked(s, id);
// A branch counts as whole when its six original nodes (prefix 1 to 6) are owned. The tree has grown to 60 nodes in five sections, but these keep their ids.
const branch = (last: string) => (s: State) => [1, 2, 3, 4, 5, 6].every((i) => s.tree.includes(last.slice(0, 2) + i));

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
    { id: "sg6", title: "Signal branch", text: "The Signal branch is whole, from Line coding to Overdrive, and the hum changed pitch. It used to complain. Now it sounds like it is working with me.", test: branch("sg6") },
    { id: "fg6", title: "Forge branch", text: "The Forge branch is whole. I can make anything in this room now. That should worry me more than it does.", test: branch("fg6") },
    { id: "sy6", title: "Systems branch", text: "The Systems branch is whole. Even asleep, the node keeps its own watch. I do not have to be the one holding it up anymore.", test: branch("sy6") },
    { id: "asc10", title: "Ten", text: "Ten ascensions. I tried to count the farm and lost my place. The node counted for me. It was off by one, and then it was not.", test: (s) => s.life.ascends >= 10 },
    { id: "rank7", title: "Zero", text: "Zero. Every goal on the board is done. I sat there afterwards and watched the numbers go up by themselves. I think that is the good part.", test: (s) => tiersDone(s) >= 7 },
    { id: "last", title: "Last entry", text: "Whole tree. I am done with this node. It does not need me, but it will want an operator. Be kind to it. Press everything. Leave it running.", test: (s) => s.tree.length >= TREE.length },
];

export const logNo = (i: number) => String(i + 1).padStart(3, "0");

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
