// What the player just earned, worked out from the hub ladder. Pure functions over HubView so the reward panel and
// its test never touch the world. An order or milestone counts as new the first time it reads "done" after the first
// look (the first look is the saved game, not news). The commission keeps one id, so a new commission name means the
// one before it was filled.
import type { HubStep, HubUnlock, HubView } from "@/lib/automation/types";

export type RewardKind = "order" | "milestone" | "commission";

export type RewardEvent = {
    /** Stable per fill: the step id, or the commission's name. */
    key: string;
    kind: RewardKind;
    /** Step id: picks the milestone art. */
    id: string;
    title: string;
    blueprints: number;
    /** The supply crate, one entry per item. */
    crate: { item: string; qty: number; name: string }[];
    /** Recipes and machines the fill opened. */
    opened: HubUnlock[];
};

export type RewardMemory = { done: string[]; commission: HubStep | null };

const kindOf = (s: HubStep): RewardKind => (s.id === "commission" ? "commission" : s.kind === "request" ? "order" : "milestone");

/** The event for one filled step. */
export function rewardOf(step: HubStep): RewardEvent {
    const bp = step.unlocks.find((u) => u.kind === "blueprints");
    return {
        key: step.id === "commission" ? step.name : step.id,
        kind: kindOf(step),
        id: step.id,
        title: step.id === "commission" ? step.name.replace(/^Commission \d+:\s*/, "") : step.name,
        blueprints: bp?.qty ?? 0,
        crate: step.unlocks.filter((u) => u.kind === "crate").map((u) => ({ item: u.icon ?? u.id, qty: u.qty ?? 1, name: u.label ?? u.name })),
        opened: step.unlocks.filter((u) => u.kind === "recipe" || u.kind === "machine"),
    };
}

/** Compare the ladder with what was seen last. Returns the new memory and the events, oldest first. */
export function diffRewards(prev: RewardMemory | null, hub: HubView): { memory: RewardMemory; events: RewardEvent[] } {
    const done = hub.steps.filter((s) => s.state === "done" && s.id !== "commission").map((s) => s.id);
    const commission = hub.steps.find((s) => s.id === "commission") ?? null;
    const memory: RewardMemory = { done, commission };
    if (!prev) return { memory, events: [] };
    const events: RewardEvent[] = [];
    for (const s of hub.steps) {
        if (s.id !== "commission" && s.state === "done" && !prev.done.includes(s.id)) events.push(rewardOf(s));
    }
    if (prev.commission && commission && prev.commission.name !== commission.name) events.push(rewardOf(prev.commission));
    return { memory, events };
}
