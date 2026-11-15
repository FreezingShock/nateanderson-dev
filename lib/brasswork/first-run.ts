// The first-run guide's steps. Pure functions over HudData, so the guide never touches the world directly.
import type { HudData } from "@/lib/automation/types";

export const FIRST_RUN_KEY = "brasswork-first-run-v1";

export type FirstRunStep = { id: string; title: string; hint: string; done: boolean };

/** The live text of the open hub order, when the goal strip is pointing at one. */
function openHubOrder(data: HudData): string | null {
    return data.nextStep.actionId === "hub-menu" && data.nextStep.text ? data.nextStep.text : null;
}

export function firstRunSteps(data: HudData): FirstRunStep[] {
    const count = (id: string) => data.machines.find((m) => m.id === id)?.count ?? 0;
    const belts = data.machines.filter((m) => m.id.startsWith("belt")).reduce((a, m) => a + m.count, 0);
    return [
        {
            id: "drill",
            title: "Place a drill",
            hint: "Pick the drill from the palette and click a resource node.",
            done: count("drill") > 0,
        },
        {
            id: "kiln",
            title: "Add a kiln",
            hint: "The kiln smelts ore into ingots. Pick it, then set its recipe in the inspector.",
            done: count("kiln") > 0,
        },
        {
            id: "belt",
            title: "Run a belt to the hub",
            hint: "Drag a line of belt from the kiln to the hub. Belts feed the hub from any side.",
            done: belts > 0,
        },
        {
            // The last step follows the hub ladder, so the scroll and the goal strip never disagree. Any filled hub
            // order counts, including the early requests that come before the first milestone. While one is open,
            // the step quotes its live order.
            id: "delivery",
            title: "Make your first delivery",
            hint: openHubOrder(data) ?? "Deliveries to the hub finish milestones and earn blueprints.",
            done: data.hub.doneCount > 0 || data.milestones.some((m) => m.done),
        },
    ];
}

export function readFirstRunDone(): boolean {
    try {
        return localStorage.getItem(FIRST_RUN_KEY) === "done";
    } catch {
        return false;
    }
}

export function writeFirstRunDone(): void {
    try {
        localStorage.setItem(FIRST_RUN_KEY, "done");
    } catch {
        /* private mode: the guide simply shows again next visit */
    }
}
