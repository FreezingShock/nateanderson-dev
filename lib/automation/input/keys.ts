// Keyboard map. Pure, so it runs in Node tests. Keys used by the site (backtick and Ctrl/Cmd+J for the
// console, "/" for search) are deliberately left alone.

export type KeyAction =
    | { type: "rotate" }
    | { type: "undo" }
    | { type: "redo" }
    | { type: "cancel" }
    | { type: "topdown" }
    | { type: "delete-hover" }
    | { type: "toggle-delete" }
    | { type: "tool"; index: number }
    | { type: "pan"; forward: number; right: number }
    | { type: "walk"; dir: WalkDir; down: boolean }
    | { type: "zoom"; factor: number }
    | { type: "space"; down: boolean };

export interface KeyLike {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    repeat?: boolean;
    type?: string;
}

const PAN_STEP = 1.5;

// WASD pans the camera while held. The index keeps a set of held keys and moves the target each frame.
export type WalkDir = "w" | "a" | "s" | "d";
const WALK_KEYS: readonly string[] = ["w", "a", "s", "d"];

export function mapKey(e: KeyLike): KeyAction | null {
    const mod = !!(e.ctrlKey || e.metaKey);
    if (e.altKey) return null;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const down = e.type !== "keyup";

    if (key === " " || key === "Spacebar") return { type: "space", down };
    // WASD is held-state, so it is handled before the keydown-only checks below. Ctrl/Cmd combos fall
    // through so Ctrl+D and friends keep their browser meaning.
    if (WALK_KEYS.includes(key) && !e.altKey && !mod) {
        return { type: "walk", dir: key as WalkDir, down };
    }
    if (!down) return null;

    if (mod) {
        if (key === "z") return e.shiftKey ? { type: "redo" } : { type: "undo" };
        if (key === "y") return { type: "redo" };
        return null;
    }
    if (e.shiftKey && key !== "ArrowUp" && key !== "ArrowDown" && key !== "ArrowLeft" && key !== "ArrowRight") return null;

    switch (key) {
        case "r":
            return e.repeat ? null : { type: "rotate" };
        case "t":
            return e.repeat ? null : { type: "topdown" };
        case "x":
            return e.repeat ? null : { type: "toggle-delete" };
        case "Delete":
        case "Backspace":
            return { type: "delete-hover" };
        case "Escape":
            return { type: "cancel" };
        case "ArrowUp":
            return { type: "pan", forward: PAN_STEP, right: 0 };
        case "ArrowDown":
            return { type: "pan", forward: -PAN_STEP, right: 0 };
        case "ArrowLeft":
            return { type: "pan", forward: 0, right: -PAN_STEP };
        case "ArrowRight":
            return { type: "pan", forward: 0, right: PAN_STEP };
        case "+":
        case "=":
            return { type: "zoom", factor: 0.9 };
        case "-":
        case "_":
            return { type: "zoom", factor: 1 / 0.9 };
        default:
            if (/^[1-9]$/.test(key)) return { type: "tool", index: Number(key) - 1 };
            return null;
    }
}
