// Quick-time events: short, skippable mini-challenges that pop up in the middle of the screen now and then.
// Winning one gives the same timed Overclock the intrusion always gave. Missing one costs nothing.
// Pure data and timing numbers here; the UI lives in components/nodefarm/events.tsx.

export type EventKind = "intrusion" | "surge" | "lock" | "trace";

export interface EventDef {
    kind: EventKind;
    code: string;
    title: string;
    /** one plain line shown before you engage */
    brief: string;
    /** the hint shown during the event, for both touch and keyboard */
    hint: string;
    /** hard limit once engaged, in seconds */
    secs: number;
    /** unlocks once Multipliers + Reboots reach this, so the first minutes stay quiet */
    from: number;
}

export const EVENTS: EventDef[] = [
    { kind: "intrusion", code: "TRACE // INTRUSION", title: "Intrusion", brief: "Someone is probing the node. Watch the key sequence, then key it back.", hint: "Tap the keys, or press 1 to 4.", secs: 10, from: 5 },
    { kind: "surge", code: "GRID // POWER SURGE", title: "Power surge", brief: "The grid is overloading. Hold to charge, release inside the green band.", hint: "Hold the button or hold Space, then let go in the band.", secs: 14, from: 5 },
    { kind: "lock", code: "LINK // SIGNAL LOCK", title: "Signal lock", brief: "A signal is drifting. Stop the sweep inside the target zone.", hint: "Tap Lock, or press Space.", secs: 14, from: 5 },
    { kind: "trace", code: "NET // BREACH TRACE", title: "Breach trace", brief: "Flagged nodes light up one at a time. Tap them before they go dark.", hint: "Tap the lit node, or press its number 1 to 9.", secs: 12, from: 8 },
];

export const EVENT_TUNE = {
    /** gap between events in seconds, [min, max], before the Wide-band scanner perk shortens it */
    every: [180, 300] as [number, number],
    /** how long the incoming card waits for you before it gives up, in seconds */
    waitSecs: 15,
    /** controls stay locked this long after anything appears so a stray tap can't trigger one */
    armMs: 650,
    /** how long the result card stays up */
    resultMs: 1700,
};

export const nextGapMs = (scanner: number, rnd = Math.random()) =>
    (EVENT_TUNE.every[0] + rnd * (EVENT_TUNE.every[1] - EVENT_TUNE.every[0])) * 1000 * Math.max(0.4, 1 - scanner * 0.08);

/** Pick a kind that is unlocked and not the one just shown (unless it is the only one). */
export function pickEvent(progress: number, last: EventKind | null, rnd = Math.random()): EventDef | null {
    const open = EVENTS.filter((e) => progress >= e.from);
    if (!open.length) return null;
    const pool = open.length > 1 ? open.filter((e) => e.kind !== last) : open;
    return pool[Math.floor(rnd * pool.length) % pool.length];
}
