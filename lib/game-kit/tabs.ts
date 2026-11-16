// Game kit: playing in more than one browser tab. Two tools, both safe to call where the browser API is missing:
//
//  - claimTab: one tab plays at a time. Each tab says hello on a BroadcastChannel when it starts or takes over; a tab
//    that hears another tab's hello calls `onSuperseded` (save, pause, go read-only). Starwright uses it.
//  - watchNewerSave: notices when another tab writes a newer save to the same key (the storage event), so this tab can
//    stop saving instead of overwriting it. Groundbreak uses it.

export type TabClaim = {
    /** Say hello again, e.g. after the player chose "Play here". Other tabs step aside. */
    claim: () => void;
    close: () => void;
};

export function claimTab(channel: string, onSuperseded: () => void): TabClaim {
    if (typeof BroadcastChannel === "undefined") return { claim: () => {}, close: () => {} };
    const id = Math.random().toString(36).slice(2);
    const ch = new BroadcastChannel(channel);
    ch.onmessage = (e: MessageEvent) => {
        if (e.data?.t !== "hello" || e.data.id === id) return;
        onSuperseded();
    };
    const claim = () => ch.postMessage({ t: "hello", id });
    claim();
    return { claim, close: () => ch.close() };
}

/**
 * Calls `onNewer` when another tab stores a save under `key` whose `savedAt` is newer than `mySavedAt()`.
 * Returns the unsubscribe.
 */
export function watchNewerSave(key: string, mySavedAt: () => number | null | undefined, onNewer: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onStore = (e: StorageEvent) => {
        if (e.key !== key || !e.newValue) return;
        const mine = mySavedAt();
        if (mine === null || mine === undefined) return;
        try {
            const theirs = (JSON.parse(e.newValue) as { savedAt?: number }).savedAt;
            if (typeof theirs === "number" && theirs > mine) onNewer();
        } catch {
            /* not JSON: not a save we can compare */
        }
    };
    window.addEventListener("storage", onStore);
    return () => window.removeEventListener("storage", onStore);
}
