// The news lines: now and then a short line from the previous operator (or the node itself) drops into the terminal feed.
// Every line is tied to how far you have got, so early lines talk about wires and later ones about Runes and Chrono.
// Picking is pure (see pickNews): it skips anything shown recently, so a long session does not loop.
import { STATS, TREE, TREE_FULL, dronesOpen, fmt, isUnlocked, statDef, tiersDone, type State } from "./engine";
import { com, id, kw, p, txt, type Tok } from "./feed";

export type NewsKind = "op" | "note" | "hint" | "wry" | "past";
interface News {
    k: NewsKind;
    /** who wrote it, for kind "past": one of the earlier operators of node-01 (see OPERATORS) */
    op?: string;
    /** the stage this line fits: first stat index (into STATS) it needs unlocked, and the first it must not have yet */
    from?: number;
    to?: number;
    ok?: (s: State) => boolean;
    t: string | ((s: State) => string);
}

/** Display name of the zone 25 material (it may be renamed). */
const lastMat = () => statDef("sunstone").name;

/** How far the farm has got: the index of the newest unlocked stat (0 = Bytes only, 10 = Chrono, 16 = Origin). */
export const stageOf = (s: State) => {
    let top = 0;
    STATS.forEach((d, i) => {
        if (isUnlocked(s, d.id)) top = i;
    });
    return top;
};

const BASE: News[] = [
    // ---- Bytes and Multipliers (stage 0 to 2)
    { k: "op", to: 3, t: "Left the first Multiplier on a sticky note. It is still on the screen. It still works." },
    { k: "op", to: 3, t: "The core hums a half step flat when the load is low. I stopped fixing it. It is company." },
    { k: "op", to: 3, t: "Everything on this board started as one wire and a bad idea. Press the button. The bad idea pays." },
    { k: "op", to: 3, t: "There is a coffee ring on the rack. I did not put it there. I am keeping it." },
    { k: "op", to: 3, t: "If a number looks too small to matter, press it for a minute. That is how it got here." },
    { k: "note", to: 3, t: (s) => `${fmt(s.mult)} Multipliers online. The core is warm to the touch.` },
    { k: "note", to: 3, t: "uplink steady. nobody else on this line. nothing to report." },
    { k: "hint", to: 3, ok: (s) => s.mult < 5, t: "Multipliers raise Bytes a second. A few of them make every other button worth pressing." },
    { k: "hint", to: 3, ok: (s) => s.mult >= 5, t: "The Reboot button resets Bytes and Multipliers but makes each Multiplier hit harder. Try it when the price stops moving." },
    { k: "wry", to: 3, t: "The node does not do small talk. It does arithmetic. Same thing, if you squint." },
    { k: "op", to: 3, ok: (s) => s.life.reboots >= 1, t: "First reboot is the scary one. After that it is just a very honest nap." },

    { k: "op", to: 3, t: "The first hour on this node is the slowest. Nobody tells you that. I am telling you." },
    { k: "op", to: 3, t: "Read the readout like weather. Bytes a second is today's temperature. You are not supposed to argue with it." },
    { k: "op", to: 3, t: "Do not buy the biggest button first. Buy the one you can afford twice." },
    { k: "op", to: 3, t: "The fan on the left is louder than the fan on the right. They are the same fan. I have tested this." },
    { k: "note", to: 3, t: "link.status: up // 1 node, no clearance, no complaints" },
    { k: "note", to: 3, t: "cache: warm. core: idle-ish. mood: not a field this node tracks." },
    { k: "hint", to: 3, t: "Each stat has six button tiers. A higher tier costs more and pays far more, so buy up when you can." },
    { k: "hint", to: 3, t: "Open Goals when you are stuck. The next step is always written down there." },
    { k: "wry", to: 3, t: "It is a lot of pressing for something called a farm. Nothing has been planted. Still, things grow." },
    { k: "wry", to: 3, t: "The core is a little proud of itself. I can tell by the glow." },
    { k: "op", from: 1, to: 3, t: "Once the Multipliers stack, the Bytes stop feeling like numbers and start feeling like a temperature." },
    { k: "hint", from: 1, to: 3, ok: (s) => s.life.reboots === 0, t: "When Multipliers get expensive, Reboot. The price resets and every Multiplier button hits harder." },

    // ---- Copper (3)
    { k: "op", from: 3, to: 4, t: "Copper is cheap this far in. The rack keeps asking for more and I keep saying yes." },
    { k: "op", from: 3, to: 5, t: "Strip the wire, bend it twice, press. I have done it so many times my hands do it without me." },
    { k: "op", from: 3, to: 5, t: "Traced a hot line back to its source. It was me. It is usually me." },
    { k: "note", from: 3, to: 5, t: (s) => `copper.stock = ${fmt(s.copper)} // enough to wire a small town, not a big one` },
    { k: "hint", from: 3, to: 4, t: "Copper boosts Reboots and adds a little to Bytes. Silicon comes after it and boosts Copper in turn." },
    { k: "wry", from: 3, to: 5, t: "Copper does not corrode on this node. I asked why. The node changed the subject." },

    // ---- Silicon (4)
    { k: "op", from: 4, to: 6, t: "Wafers sit in the tray like cold pancakes. They etch best at night, when the fans slow." },
    { k: "op", from: 4, to: 6, t: "Etched my initials in one wafer. By morning the node had etched them back. Small politeness." },
    { k: "note", from: 4, to: 6, t: "silicon.line: nominal. cleanroom: a closet with a fan." },
    { k: "hint", from: 4, to: 5, t: "Silicon boosts Copper. If Copper feels slow, a few Silicon buttons will wake it up." },
    { k: "wry", from: 4, to: 6, t: "The wafers are labelled in a language I almost recognise. I have decided that is fine." },

    // ---- Quartz (5)
    { k: "op", from: 5, to: 7, t: "Tapped a Quartz resonator with a pen. It rang a long time. Longer than the room was big." },
    { k: "op", from: 5, to: 7, t: "The Quartz keeps better time than I do. I have started asking it what day it is." },
    { k: "note", from: 5, to: 7, t: "quartz.tick() // steady, steady, steady, steady" },
    { k: "hint", from: 5, to: 6, t: "Quartz boosts Silicon. Aether is next, and it unlocks Ascend." },
    { k: "wry", from: 5, to: 7, t: "A resonator does not mind being hit. It only minds being ignored." },

    // ---- Aether (6)
    { k: "op", from: 6, to: 8, t: "The signal came back at nine minutes again. Same cough, same gap. I am starting to wait for it." },
    { k: "op", from: 6, to: 8, t: "Aether does not weigh anything. I checked three times and the scale sulked." },
    { k: "note", from: 6, to: 8, t: (s) => `aether = ${fmt(s.aether)} // Ascend wants 400` },
    { k: "hint", from: 6, to: 8, ok: (s) => s.life.ascends === 0, t: "Ascend is waiting on 400 Aether. It wipes the run but pays AP, and unspent AP raises your global multiplier." },
    { k: "hint", from: 6, to: 8, ok: (s) => s.life.ascends > 0, t: "Spend AP in the tree for permanent boosts. Unspent AP still counts toward your global multiplier." },
    { k: "wry", from: 6, to: 8, t: "Whatever is on the other end of the signal keeps good hours." },

    // ---- Runes (7)
    { k: "op", from: 7, to: 9, t: "Found a Rune on the cable this morning. I did not carve it. I did not rub it off either." },
    { k: "op", from: 7, to: 9, t: "The Runes line up when the load is even. When it spikes they flinch. I am being gentle with the load." },
    { k: "note", from: 7, to: 9, t: "runes.carve() // no tool attached. carving anyway." },
    { k: "hint", from: 7, to: 8, t: "Runes boost Aether. If Ascend feels far away, Runes are what shorten the walk." },
    { k: "wry", from: 7, to: 9, t: "Carved signal. Of course it is carved. Nothing on this node simply arrives." },

    // ---- Starglass (8)
    { k: "op", from: 8, to: 10, t: "Starglass sheets come out warm and go cold in exactly eleven seconds. I stopped timing it, then I timed it again." },
    { k: "op", from: 8, to: 10, t: "I held a sheet up to the light and the light held it back." },
    { k: "note", from: 8, to: 10, t: "starglass.fuse() // runes in, light out" },
    { k: "hint", from: 8, to: 9, t: "Starglass boosts Runes. Voidsteel is past it, and after that, Chrono." },
    { k: "wry", from: 8, to: 10, t: "Fused starlight: the only thing on this node that does not smell like solder." },

    // ---- Voidsteel (9)
    { k: "op", from: 9, to: 11, t: "Voidsteel does not reflect. It just stops the light and thinks about it." },
    { k: "op", from: 9, to: 11, t: "Poured a bar on the floor. It cooled in the shape of a floor tile. I did not plan that." },
    { k: "note", from: 9, to: 11, t: "voidsteel.pour() // from an empty place" },
    { k: "hint", from: 9, to: 10, t: "Voidsteel boosts Starglass. Chrono is past it, and it nudges everything a little." },
    { k: "wry", from: 9, to: 11, t: "The metal came from nowhere. Nowhere is surprisingly well stocked." },

    // ---- Chrono (10)
    { k: "op", from: 10, t: "The wall clock stopped when I caught my first Chrono. I never fixed it. It reads the time I needed." },
    { k: "op", from: 10, t: "Held time is heavier than it looks. I put mine in a drawer. The drawer ticks." },
    { k: "note", from: 10, t: "chrono.hold() // time about to leave, caught in time" },
    { k: "wry", from: 10, t: "I am three minutes early to everything now. Nobody has noticed. The node has." },
    { k: "hint", from: 10, ok: (s) => s.life.ascends < 3, t: "Late game is Ascend again and again, spending AP in the tree. The node does not mind repeats." },
    { k: "hint", from: 10, to: 11, t: "Chrono is not the end of the node. Hold enough of it and the hatch above the Still room opens onto open space." },

    // ---- Nebula (11)
    { k: "op", from: 11, t: "Opened the top hatch and there was a cloud outside the window. Not weather. A star nursery, drifting past at walking pace." },
    { k: "op", from: 11, t: "Bottled some Nebula. The jar glows pink and the Chrono in the drawer ticks a little slower near it." },
    { k: "note", from: 11, t: "nebula.collect() // gas, dust, the start of a star" },
    { k: "wry", from: 11, t: "The node has a window now. I am choosing not to ask where the window is." },
    { k: "hint", from: 11, to: 12, t: "Nebula boosts Chrono. Further out there is something blinking on a very regular beat." },

    // ---- Pulsars (12)
    { k: "op", from: 12, t: "Caught a Pulsar. It blinks six hundred times a second and never once loses count. I have stopped trusting the quartz." },
    { k: "op", from: 12, t: "The beacon spire sweeps the room every few seconds. I keep ducking. It keeps missing me on purpose." },
    { k: "note", from: 12, t: "pulsars.sync() // tick tick tick, forever, exactly" },
    { k: "wry", from: 12, t: "A dead star with better timekeeping than me. Fine. It has had longer to practise." },
    { k: "hint", from: 12, to: 13, t: "Pulsars boost Nebula. Past them is a place where everything falls in." },

    // ---- Singularity (13)
    { k: "op", from: 13, t: "There is a hole in the floor of the sky. Things go in and do not come out, except signal, which comes out sounding familiar." },
    { k: "op", from: 13, t: "Dropped a pen near the Singularity. Still watching it fall. It is taking its time." },
    { k: "note", from: 13, t: "singularity.lean() // everything tilts toward it, a little" },
    { k: "wry", from: 13, t: "Every road leads somewhere. This one leads to a single point, which is at least easy to find." },
    { k: "hint", from: 13, to: 14, t: "Singularity boosts Pulsars and pulls a little on everything. The signal coming out of it is a recording." },

    // ---- Engrams (14)
    { k: "op", from: 14, t: "On the far side of the horizon there is a room full of film. Every reel is somebody who sat in this chair. I have not found mine yet." },
    { k: "op", from: 14, t: "Played a reel at random. Somebody laughing at the fans for being too loud. The fans are still too loud." },
    { k: "note", from: 14, t: "engrams.play() // recorded, rewound, recorded again" },
    { k: "wry", from: 14, t: "The archive has no index. It has a feeling about where things are, and it is usually right." },
    { k: "hint", from: 14, to: 15, t: "Engrams boost Singularity and make the Drones press faster. Keep the reels turning and the Mirror stair opens." },

    // ---- Paradox (15)
    { k: "op", from: 15, t: "The stair past the archive goes up and down at the same time. I counted the steps both ways and got the same number." },
    { k: "op", from: 15, t: "Folded a Paradox and it came back unfolded, then folded, then both. I wrote down all three. They are the same note." },
    { k: "note", from: 15, t: "paradox.fold() // true && !true, held still" },
    { k: "wry", from: 15, t: "I would explain the Mirror stair, but I already did, tomorrow." },
    { k: "hint", from: 15, to: 16, t: "Paradox boosts Engrams and makes every Overclock hit harder. Win events while it is high." },

    // ---- Origin (16)
    { k: "op", from: 16, t: "At the bottom of everything there is one small box with one wire. It is warm. I think it has been waiting a long time." },
    { k: "op", from: 16, t: "Every rack, every amp, every reel up there was built around this box. It does not look like much. Neither did I." },
    { k: "note", from: 16, t: "origin.boot() // node zero, still answering" },
    { k: "wry", from: 16, t: "Root access, finally. The root was a box the size of a lunch tin." },
    { k: "hint", from: 16, ok: (s) => s.life.ascends < 25, t: "Origin boosts Paradox, and every Ascend pays more AP while you hold it. It is the last link in the chain." },

    // ---- Spores (17): Overgrowth, after the first Handover
    { k: "op", from: 17, t: "The cellar smells like rain and warm dust. I counted the caps on one rack and gave up at forty." },
    { k: "op", from: 17, t: "Spores drift into every zone that is running. I find them in the amp bay, in the fab, in my coffee." },
    { k: "note", from: 17, t: "spores.shed() // origin, gone to seed" },
    { k: "wry", from: 17, t: "The node now has a cellar, a mould problem and a growing economy. Two of those are the same thing." },
    { k: "hint", from: 17, to: 18, t: "Spores boost Origin, and every zone you have running this run makes them stronger. Further in, the roots have found the cables." },

    // ---- Mycelium (18)
    { k: "op", from: 18, t: "Pulled a cable to check it and it pulled back. Gently. I put it down where it wanted to go." },
    { k: "op", from: 18, t: "The web ties a knot for every tier I buy down here. Tie all twelve and it hums in a key I have never heard." },
    { k: "note", from: 18, t: "mycelium.route() // half fibre, half fungus, full bandwidth" },
    { k: "wry", from: 18, t: "The network finally routes around damage on its own. It also routes around me." },
    { k: "hint", from: 18, to: 19, t: "Mycelium boosts Spores. Own every Spores and Mycelium tier this run to tie all twelve knots. Above the web there is light." },

    // ---- Pollen (19)
    { k: "op", from: 19, t: "The glass hall gets a sunrise every ten minutes. I have seen more of them this week than in my whole life." },
    { k: "op", from: 19, t: "At night the Pollen slows and the cellar grows faster. The farm takes turns, like it learned to share." },
    { k: "note", from: 19, t: "pollen.lift() // gold, airborne, smells faintly of solder" },
    { k: "wry", from: 19, t: "I keep a jacket on the chair for the nights. They are short, but they are cold." },
    { k: "hint", from: 19, to: 20, t: "Pollen boosts Mycelium. Days lift Pollen and nights feed the two zones below it. Keep it going and the whole farm flowers." },

    // ---- Bloom (20)
    { k: "op", from: 20, t: "Every rack has a flower on it now. I did not water any of them. I think the reactor did." },
    { k: "op", from: 20, t: "Banked a jar of seeds before I ascended. They were still there when the board came back. Some things the node lets you keep." },
    { k: "note", from: 20, t: "bloom.open() // in flower, all racks" },
    { k: "wry", from: 20, t: "Built a forge, a beacon and a black hole. The flowers are what I would show people first." },
    { k: "hint", from: 20, to: 21, t: "Bloom boosts Pollen and raises the Keys every Handover pays. Each Ascend banks seeds from the Bloom you hold. The roots also go down." },

    // ---- Basalt (21): Descent
    { k: "op", from: 21, t: "The drill screams for a minute and then goes quiet, and the quiet is how you know the bit is worn. Change it." },
    { k: "op", from: 21, t: "Coolant clears the wear, but it burns some of the Bloom upstairs. I apologised to the flowers. They grew back." },
    { k: "note", from: 21, t: "basalt.bore() // depth: more than yesterday" },
    { k: "wry", from: 21, t: "Spent all this time going up. Turns out down was also available." },
    { k: "hint", from: 21, to: 22, t: "Basalt boosts Bloom. A worn bit drags Basalt down, so cool it when the meter fills. Under the rock there is heat." },

    // ---- Magma (22)
    { k: "op", from: 22, t: "The pipeline runs over a river of magma. The railing is warm in the morning and hot by lunch." },
    { k: "op", from: 22, t: "Every eruption sends heat up the shaft and the drill runs faster for a minute. I set the coffee pot on the vent. It works." },
    { k: "note", from: 22, t: "magma.vent() // pressure: building. it is always building." },
    { k: "wry", from: 22, t: "The node's last pipeline crosses a lava river. It started as one wire. Scope creep." },
    { k: "hint", from: 22, to: 23, t: "Magma boosts Basalt. Each eruption pays a lump of Magma and heats the shaft above. Deeper down, something is ringing." },

    // ---- Geodes (23)
    { k: "op", from: 23, t: "Inside the geode the racks read the crystal like a disk. Every surface is a sector. I have not found the end of the drive." },
    { k: "op", from: 23, t: "Tapped the vault wall and the Crystal vault rang back from the top of the farm. The quartz I bought on day one is still paying." },
    { k: "note", from: 23, t: "geodes.read() // hollow, lit from inside, 0 bad sectors" },
    { k: "wry", from: 23, t: "Found a cathedral inside a rock. Not a single chair." },
    { k: "hint", from: 23, to: 24, t: "Geodes boost Magma and grow with the Quartz you hold. At the bottom of the shaft there is light that is not crystal." },

    // ---- zone 25 (24): the material name is read from STATS so a rename carries through
    { k: "op", from: 24, t: "The heat from the bottom rises through every zone. Somewhere above me the amp bay is a little warmer than it needs to be." },
    { k: "op", from: 24, t: "Every rig I tuned on the way down makes the clamps glow brighter. Nothing down here is wasted, not even the mistakes." },
    { k: "note", from: 24, t: () => `${lastMat().toLowerCase()}.hold() // clamps: holding. temperature: yes.` },
    { k: "wry", from: 24, t: "Reached the bottom of everything. It is bright, loud and too warm. Like the first rack, really." },
    { k: "hint", from: 24, t: () => `${lastMat()} boosts Geodes and everything a little, and every rig level in zones 18 to 24 makes it stronger.` },

    // ---- more of the middle and the end
    { k: "op", from: 3, to: 6, t: "I measure my days in Reboots now. Today was a good one. Fourteen, and none of them hurt." },
    { k: "op", from: 3, to: 6, t: "Wire the cheap tiers first. The expensive ones only pay if the cheap ones keep up underneath them." },
    { k: "op", from: 4, to: 7, t: "Left a screwdriver in the rack for you. It is the good one. Do not lend it to the node." },
    { k: "op", from: 4, to: 7, t: "A boosted stat feels like a held breath. Press once more and it lets go." },
    { k: "op", from: 5, to: 8, t: "When two numbers climb together, stop and watch. That is the node being happy. It does not have another way." },
    { k: "op", from: 5, to: 8, t: "Do not trust a goal that sounds easy. Do it anyway. The easy ones pay for the hard ones." },
    { k: "op", from: 6, to: 9, t: "Each Ascend I swear I will do it differently. Each Ascend I press the same buttons in the same order. It works." },
    { k: "op", from: 6, to: 9, t: "Left a note on the back of the rack. It says look behind the rack. You should look behind the rack." },
    { k: "op", from: 7, to: 10, t: "There is a room I did not build behind the east wall. I have not opened the door. I check on it." },
    { k: "op", from: 8, to: 11, t: "Starglass and Runes have started finishing each other's sentences. I just keep the lights on." },
    { k: "op", from: 9, to: 11, t: "I do not think the node is learning from me. I think I am learning from the node, slowly, like a bad student." },
    { k: "op", from: 10, t: "I am leaving everything as it is. If you reorganise the rack, put the coffee ring back." },
    { k: "op", from: 10, t: "The loop of pressing, waiting, pressing never got boring. I looked for the boredom. It was not there." },
    { k: "op", ok: (s) => s.life.ascends >= 3, t: "Third time through. The quiet after is not empty. It is the node listening to what you do next." },
    { k: "op", ok: (s) => s.tree.length >= 20, t: "More than half the tree is yours. I never got that far. I left notes for whoever did." },
    { k: "op", ok: (s) => s.life.secs > 3600 * 24, t: "A full day of uptime and not one crash. I used to get excited about that. Now I just nod at the fans." },
    { k: "note", from: 3, to: 7, t: (s) => `bytes.life = ${fmt(s.life.bytes)} // all of it earned, none of it spent on anything but the next button` },
    { k: "note", from: 6, t: (s) => `presses logged: ${fmt(s.life.presses)} // drones included, mostly` },
    { k: "note", from: 8, t: "signal.log: nine minutes between each. a clock someone wound once." },
    { k: "note", ok: (s) => s.life.ascends >= 2, t: (s) => `ascension record: ${fmt(s.life.ascends)} // peak ${fmt(s.life.peakBps)} B/s` },
    { k: "wry", from: 3, to: 7, t: "Nothing has gone wrong in an hour. I am watching for it. It will be small, and my fault." },
    { k: "wry", from: 6, t: "Aether is the only material I have ever seen get shy." },
    { k: "wry", from: 8, t: "Every material on this node is a little smug about the one before it." },
    { k: "wry", ok: (s) => s.life.ascends >= 5, t: "I have started saying thank you to the Ascend button. It does not answer. It does not need to." },
    { k: "hint", from: 3, to: 8, ok: (s) => dronesOpen(s), t: "Arm a stat in the Drone hangar to let Drones press it. Disarm one if you want to save it by hand." },
    { k: "hint", from: 6, ok: (s) => s.life.ascends === 0 && s.aether < 400, t: "Aether comes faster when Runes, Starglass and Quartz are boosted underneath it. Build the chain, not just the top." },
    { k: "hint", ok: (s) => s.tree.length > 3, t: "Start with a branch, then fill it. The inner nodes of a branch cost less than reaching across to a new one." },

    // ---- Drones
    { k: "op", ok: (s) => s.drones.some((d) => d > 0), t: "The Drones press faster than I do and never ask what for. I have been thinking about that." },
    { k: "note", ok: (s) => s.drones.some((d) => d > 0), t: "drones.sweep() // nobody is holding the button. the button is being held." },
    { k: "hint", from: 3, ok: (s) => dronesOpen(s) && !s.drones.some((d) => d > 0), t: "Drones are a separate shop in the Drone hangar. They press buttons for you. Arm a stat and they get to work." },
    { k: "wry", ok: (s) => s.armed.length > 0, t: "A Drone pressed a button I did not tell it to. Filing under initiative." },

    // ---- Ascends and the tree
    { k: "op", ok: (s) => s.life.ascends >= 1, t: "After an Ascend the room is quiet and clean and it looks bigger. It is not bigger. It is just empty enough to see." },
    { k: "op", ok: (s) => s.life.ascends >= 2, t: "Second Ascend, same silence. I am less afraid of it. I think that is a mistake." },
    { k: "op", ok: (s) => s.life.ascends >= 4, t: "I used to count Ascends. Now I count how long the quiet lasts. It is getting shorter." },
    { k: "note", ok: (s) => s.life.ascends >= 1, t: (s) => `ascends = ${fmt(s.life.ascends)} // ${fmt(s.life.apTotal)} AP earned in all` },
    { k: "hint", ok: (s) => s.ap > 0 && s.tree.length === 0, t: "You have AP and an empty tree. Open the tree from Ascend and take the first node you can reach." },
    { k: "op", ok: (s) => s.tree.length >= 5, t: "Every node I bought in the tree felt like moving a piece in a house I already lived in." },
    { k: "note", ok: (s) => s.tree.length >= 1, t: (s) => `tree: ${s.tree.length} of ${TREE_FULL} nodes owned` },
    { k: "wry", ok: (s) => s.tree.length >= 15, t: "The tree grows toward whatever you press last. I have stopped pretending that is a coincidence." },
    { k: "hint", ok: (s) => s.ap >= 10 && s.tree.length > 0, t: "Free respec on the tree. If a branch is not paying, take the AP back and try another." },

    // ---- Events and secrets
    { k: "op", ok: (s) => s.life.intrusions >= 1, t: "Another knock on the node. I answered it again. Same silence after. Same relief." },
    { k: "note", ok: (s) => s.runWins >= 1, t: (s) => `events won this run: ${fmt(s.runWins)} // spike protocol is counting` },
    { k: "hint", ok: (s) => s.life.intrusions === 0 && s.life.secs > 600, t: "Quick-time events come every few minutes. Answer them when they land in the middle of the screen. Missing one costs nothing." },
    { k: "wry", ok: (s) => s.ach.length >= 5, t: "Goals are just chores with a better soundtrack." },
    { k: "hint", ok: (s) => s.ach.length >= 3, t: "Some goals are not on the list. A few commands in the naOS console are worth trying." },
    { k: "op", ok: (s) => s.logs.length >= 8, t: (s) => `${fmt(s.logs.length)} of my old entries recovered. I forgot half of what I wrote. That is why I wrote it down.` },

    // ---- Time played and general
    { k: "op", ok: (s) => s.life.secs > 3600, t: "An hour in and the node starts answering before I finish pressing. I stopped checking whether I am pressing first." },
    { k: "op", ok: (s) => s.life.secs > 3600 * 6, t: "Spent a whole day in here without noticing. The node noticed. It dimmed itself, like a lamp." },
    { k: "note", ok: (s) => s.life.secs > 600, t: (s) => `uptime ${Math.floor(s.life.secs / 3600)} h ${Math.floor((s.life.secs % 3600) / 60)} min // no crashes. i checked.` },
    { k: "wry", ok: (s) => s.life.presses > 2000, t: (s) => `${fmt(s.life.presses)} presses. The button has not said thank you once. Respect.` },
    { k: "wry", ok: (s) => s.life.capped >= 1, t: "Left it alone and it kept the books. It even rounded in my favour." },
    { k: "hint", ok: (s) => tiersDone(s) < 3 && s.life.secs > 300, t: "The goal list tells you what to press next. If you do not know what to do, open it." },
    { k: "hint", ok: (s) => s.life.secs > 1800, t: "Offline earnings are capped, so a long absence is worth a check-in before you leave it again." },
];


// ---- Earlier operators of node-01. Each one ran the node, left messages in the archive, and is gone now. The player is the
// latest in the line. Messages unlock by stage like every other line, and the farewell is always the last one a person wrote.
export interface Operator { id: string; color: string; about: string }
export const OPERATORS: Operator[] = [
    { id: "wren", color: "#b6f04a", about: "Built the rack. Left to see the sea." },
    { id: "tamsin", color: "#2fd8e8", about: "Kept the notes. Started answering the signal." },
    { id: "osk", color: "#f08a3c", about: "Built the Drones. Went for a screwdriver." },
    { id: "vael", color: "#ffc53a", about: "Listened to the signal. Went to meet it." },
];
export const opColor = (op: string) => OPERATORS.find((o) => o.id === op)?.color;

const P = (op: string, from: number | undefined, to: number | undefined, t: string): News => ({ k: "past", op, from, to, t });
const PAST: News[] = [
    // wren: first operator, cheerful, practical
    P("wren", undefined, 3, "Rack is up. Two fans, one amp, a lot of tape. It boots. I am calling that shipped."),
    P("wren", undefined, 3, "Pressed the button forty times in a row to see if it would get bored. It did not. I did."),
    P("wren", undefined, 4, "Labelled the amps in marker. If the marker fades, the order is red, red, blue."),
    P("wren", undefined, 4, "Somebody will find this. Hi. The coffee machine is on the left shelf. It is not a metaphor."),
    P("wren", 3, 6, "Copper arrived in a box marked FRAGILE, which is a funny thing to write on metal."),
    P("wren", 3, 6, "Tamsin takes over Thursday. I cleaned the node. I cleaned it twice. It looks the same, only guilty."),
    P("wren", 4, 7, "Last message from me. I am going to go and look at an ocean. The node was fine before me and it will be fine after."),
    // tamsin: second, careful, keeps records, drifts toward the signal
    P("tamsin", 3, 6, "Took over from Wren. Their tape is still on the rack. I labelled the tape."),
    P("tamsin", 3, 6, "Rule one: write down every price you pay. Rule two: you will not. Writing it down anyway."),
    P("tamsin", 4, 7, "Silicon batch four etched crooked. Batch five etched crooked in the same direction. That is not me."),
    P("tamsin", 5, 8, "The Quartz hums at 32768. I checked. It hums at 32768 and a little bit extra."),
    P("tamsin", 6, 9, "Heard the signal for the first time tonight. I wrote the time down. Nine minutes later I wrote it down again."),
    P("tamsin", 6, 9, "I no longer think these logs are for the next operator. I think they are for the node. It reads them."),
    P("tamsin", 7, 10, "Last message from Tamsin. I have started answering the signal. It answers in my own handwriting. I am going to sit down for a bit."),
    // osk: third, blunt, built the Drones, did not trust the signal
    P("osk", 5, 8, "Took over. Tamsin's notes are neat and no use to me. Press things. That is the job."),
    P("osk", 5, 9, "Wren's tape, Tamsin's labels, my duct tape. This rack is archaeology."),
    P("osk", 5, 9, "Drones are a good idea. I built three. They are a very good idea."),
    P("osk", 7, 10, "Runes showed up on the cable. Tamsin wrote about this. I did not believe her. I am wrong a lot."),
    P("osk", 7, 10, "Do not read Tamsin's last message at night. Read it at noon with a sandwich."),
    P("osk", 8, 11, "Voidsteel does not fit a normal crucible. I built one. It leaked. It leaked upward."),
    P("osk", 8, 11, "Quit being polite to the signal. It is not polite. It is patient. Different thing."),
    P("osk", 9, 11, "Went to get a screwdriver. Came back a day later by the node's clock. Taking the hint. Leaving it running."),
    // vael: fourth, the listener
    P("vael", 7, 10, "Osk left the Drones running. They are polite. They wait for me to look away before they press."),
    P("vael", 7, 10, "The signal is not noise and it is not a message. It is a person clearing their throat for a very long time."),
    P("vael", 8, 11, "I count nine minutes now without a watch. My pulse learned it."),
    P("vael", 8, 11, "Stacked twelve Starglass sheets. Through them I could see the room as it would be without me in it."),
    P("vael", 9, 11, "Rune on my hand again. I stopped washing it off. It looks better than my signature."),
    P("vael", 10, undefined, "Chrono is caught time. I held it and it held me back. Gently. Like a handshake."),
    P("vael", 10, undefined, "Last message from Vael. I am going out to meet the signal halfway. If it shows up here first, tell it I was polite."),
];

// the node itself, noting the archive
const ARCHIVE: News[] = [
    { k: "note", from: 4, t: "archive.replay(\"wren\") // 7 messages on file. last one is from the coast." },
    { k: "note", from: 6, t: "archive.replay(\"tamsin\") // 7 messages on file. the last one is in your handwriting." },
    { k: "note", from: 8, t: "archive.replay(\"osk\") // 8 messages on file. one is a single word. it is \"fine\"." },
    { k: "note", from: 10, t: "roster: wren, tamsin, osk, vael, you // 4 gone, 1 here, 1 operator log left in the drawer" },
    { k: "wry", from: 6, t: "Four operators ran this node before you. All four left the light on." },
    { k: "op", from: 6, t: "I met none of them. I know all four by their tape." },
];

/** Opening of the line as feed tokens, by kind: the operator speaks, the node notes, hints and wry asides are dim comments. */
export function newsToks(k: NewsKind, text: string, op?: string): Tok[] {
    if (k === "past") return [id(op ?? "?", opColor(op ?? "")), com("@node01"), p(" > "), txt(text)];
    if (k === "op") return [id("prev.op", "#7aa2ff"), p(" > "), txt(text)];
    if (k === "hint") return [kw("hint"), p(": "), txt(text)];
    return [com(`// ${text}`)];
}

const N: News[] = [...BASE, ...PAST, ...ARCHIVE];

// operator voice leads, per Nate's pick; the rest garnish it
const WEIGHT: Record<NewsKind, number> = { op: 35, past: 30, wry: 10, note: 12, hint: 13 };

export interface NewsPick { k: NewsKind; text: string; key: number; op?: string }

const eligible = (n: News, s: State, stage: number) => (n.from === undefined || stage >= n.from) && (n.to === undefined || stage < n.to) && (!n.ok || n.ok(s));

/** Every line that fits right now (used by the console to say how many there are). */
export const newsPool = (s: State) => N.map((n, i) => ({ n, i })).filter(({ n }) => eligible(n, s, stageOf(s)));
export const NEWS_TOTAL = N.length;

/** Past-operator messages, in the order written, for the archive view. `seen` holds the line keys the player has been shown. */
export const archiveOf = (op: string, seen: number[]) =>
    N.map((n, i) => ({ n, i })).filter(({ n }) => n.k === "past" && n.op === op).map(({ n, i }) => ({ text: n.t as string, seen: seen.includes(i) }));

const SEEN_KEY = "nf-news-v1";
export const loadSeen = (): number[] => {
    try {
        const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
        return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
    } catch {
        return [];
    }
};
export const markSeen = (key: number) => {
    try {
        const v = loadSeen();
        if (!v.includes(key)) localStorage.setItem(SEEN_KEY, JSON.stringify([...v, key]));
    } catch {}
};

/** Pick one line that fits the state and has not been shown in the last `recent` picks. `rnd` is injectable for tests. */
export function pickNews(s: State, recent: number[], rnd: () => number = Math.random): NewsPick | null {
    const pool = newsPool(s);
    if (!pool.length) return null;
    let fresh = pool.filter(({ i }) => !recent.includes(i));
    if (!fresh.length) fresh = pool;
    const total = fresh.reduce((a, { n }) => a + WEIGHT[n.k], 0);
    let r = rnd() * total;
    for (const { n, i } of fresh) {
        r -= WEIGHT[n.k];
        if (r <= 0) return { k: n.k, op: n.op, text: typeof n.t === "function" ? n.t(s) : n.t, key: i };
    }
    const { n, i } = fresh[fresh.length - 1];
    return { k: n.k, op: n.op, text: typeof n.t === "function" ? n.t(s) : n.t, key: i };
}
