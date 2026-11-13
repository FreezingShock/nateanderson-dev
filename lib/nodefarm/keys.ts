/** Every Node Farm key in one place. The `?` sheet and the Codex "Hotkeys" entry both read this, so they cannot drift. */
export type NfKeyRow = { keys: string[]; label: string; /** shown only once this system exists in the save */ needs?: "tree" | "lab" | "hand" | "stress" };

export const NF_KEY_GROUPS: { title: string; rows: NfKeyRow[] }[] = [
    {
        title: "Node Farm: windows",
        rows: [
            { keys: ["M"], label: "Map" },
            { keys: ["O"], label: "Goals" },
            { keys: ["L"], label: "Records" },
            { keys: ["A"], label: "Ascend" },
            { keys: ["T"], label: "Prestige tree", needs: "tree" },
            { keys: ["R"], label: "Exploit Lab", needs: "lab" },
            { keys: ["H"], label: "Handover", needs: "hand" },
            { keys: ["K"], label: "Firmware", needs: "hand" },
            { keys: ["X"], label: "Stress tests", needs: "stress" },
            { keys: ["C"], label: "Codex" },
            { keys: ["S"], label: "Menu and settings" },
            { keys: ["F"], label: "Full screen" },
        ],
    },
    {
        title: "Node Farm: playing",
        rows: [
            { keys: ["G"], label: "Show me the next step" },
            { keys: ["P"], label: "Press the glowing button. Hold to keep going." },
            { keys: ["1–6"], label: "Press that tier on the zone in the middle of the screen" },
            { keys: ["Q", "E"], label: "Previous or next arc" },
            { keys: ["Z"], label: "Fold or open the zone in the middle of the screen" },
        ],
    },
    {
        title: "Node Farm: in a window or event",
        rows: [
            { keys: ["Esc"], label: "Closes the top layer only: the sheet, search or console first, then an event, then the window. In a tree, the first press lets go of the picked node." },
            { keys: ["Space", "Enter"], label: "Digits pick a Rogue process offer; hold Space to decrypt Cold storage." },
            { keys: ["←↑↓→", "+", "−", "0"], label: "In a tree: pan, zoom, fit" },
        ],
    },
];

export const NF_KEYS_NOTE = "Game keys work only on this page, and are off while you type, with Ctrl, Cmd or Alt held, or while search, the console or a full-screen moment is open. On this page G is the next-step key, so the site's g-then-number jump is off here; [ and ] still step through the sections.";

/** True when the key press belongs to a text field, a held modifier, or an IME. */
export const keyIsTyping = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return true;
    const el = e.target as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** A site panel (search, console, site map, key sheet) or a full-screen moment owns the keyboard. */
export const NF_OVERLAY_SEL = ".nv-scrim, .cn-panel, .nf-ev-scrim:not([data-out]), .nf-aw, .nf-rx, .nf-hcut";
export const keyOverlay = () => !!document.querySelector(NF_OVERLAY_SEL);
