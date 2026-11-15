// Menu and button sounds, wired by delegation so no menu component needs editing: hover ticks and press clicks on
// anything clickable inside the game, and an open / close sound when a MenuWindow's scrim appears or starts closing.
import { playSound } from "./sfx";

const CLICKABLE = "button, [role=button], [role=switch], [role=radio], a[href], summary, input[type=range]";

export function attachUiSounds(root: HTMLElement): () => void {
    const over = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        const t = (e.target as Element | null)?.closest?.(CLICKABLE);
        if (!t || t === (e.relatedTarget as Element | null)?.closest?.(CLICKABLE)) return;
        if ((t as HTMLButtonElement).disabled) return;
        playSound("hover");
    };
    const down = (e: PointerEvent) => {
        const t = (e.target as Element | null)?.closest?.(CLICKABLE);
        if (!t || (t as HTMLButtonElement).disabled) return;
        playSound(t.getAttribute("role") === "switch" || t.getAttribute("role") === "radio" ? "toggle" : "press");
    };
    root.addEventListener("pointerover", over, { passive: true });
    root.addEventListener("pointerdown", down, { passive: true, capture: true });

    const isScrim = (n: Node): n is HTMLElement => n instanceof HTMLElement && n.classList.contains("bw-window-scrim");
    const seen = new WeakSet<HTMLElement>();
    const mo = new MutationObserver((list) => {
        for (const m of list) {
            if (m.type === "childList") {
                m.addedNodes.forEach((n) => {
                    if (isScrim(n)) playSound("open");
                });
            } else if (m.type === "attributes" && isScrim(m.target) && m.target.dataset.closing === "true" && !seen.has(m.target)) {
                seen.add(m.target);
                playSound("close");
            }
        }
    });
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-closing"] });
    return () => {
        root.removeEventListener("pointerover", over);
        root.removeEventListener("pointerdown", down, { capture: true });
        mo.disconnect();
    };
}
