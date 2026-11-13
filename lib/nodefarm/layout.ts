// Board layout helpers (less scrolling): which arcs are on the board, how many buttons a zone can pay for, and the
// "click blank space to fold" rule. Pure functions, no React.
import { ARCS, arcKey } from "./zones/arcs";
import { STATS, TIERS, button, isUnlocked, type ButtonStat, type State, type StatId } from "./engine";

/** Set in the fold record once the one-arc-at-a-time layout has tidied an old save's arcs. */
export const ACC_KEY = "layout:v2";

/** The first zone still encrypted (it shows as a locked preview at the end of its arc). */
export const firstLockedId = (s: State) => STATS.find((x) => !isUnlocked(s, x.id))?.id;

/** Arcs with at least one zone decrypted, in order. These take part in the one-arc-at-a-time fold. An arc that only
 * holds the next encrypted zone is not listed: it always shows its locked preview, open. */
export function shownArcIds(s: State): string[] {
    return ARCS.filter((a) => a.zones.some((z) => isUnlocked(s, z as StatId))).map((a) => a.id);
}

/** How many of a zone's buttons you can pay for right now (0 for Bytes and locked zones). */
export function readyCount(s: State, id: StatId): number {
    if (id === "bytes" || !isUnlocked(s, id)) return 0;
    let n = 0;
    for (let k = 0; k < TIERS; k++) {
        const b = button(s, id as ButtonStat, k);
        if ((s[b.pays] as number) >= b.cost) n++;
    }
    return n;
}

/** A fold record with only `id` open among the arcs (other keys kept). */
export function soloArc(folded: Record<string, boolean>, id: string): Record<string, boolean> {
    return { ...folded, ...Object.fromEntries(ARCS.map((a) => [arcKey(a.id), a.id !== id])) };
}

/** Things a click must never fold through: controls, links, fields and anything marked data-nofold. */
export const NO_FOLD = "button, a, input, select, textarea, label, summary, [role='button'], [role='slider'], [role='switch'], [contenteditable], [data-nofold], .nf-ze, .nf-btn";

/**
 * Click on blank space: a folded panel opens from anywhere on it; an open panel folds from its header (the title bar
 * and the name line, everything outside the body), so a near miss between buy buttons never folds a zone.
 * Returns the fold button to press, or null.
 */
export function blankFoldTarget(target: HTMLElement): HTMLButtonElement | null {
    if (target.closest(NO_FOLD)) return null;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (sel && !sel.isCollapsed && sel.toString().trim()) return null; // finishing a text selection
    const row = target.closest<HTMLElement>(".nf-row[data-open]");
    if (!row) return null;
    const fold = row.querySelector<HTMLButtonElement>(":scope > .nf-bar-t .nf-fold");
    if (!fold) return null;
    if (row.dataset.open === "false") return fold;
    return target.closest(".nf-body") ? null : fold;
}
