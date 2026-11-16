// Game kit: the toast queue rule, kept pure so it can be tested. A toast is a short note over the game ("Iron is on
// site."). The React side (useToasts in components/game-kit) adds the timers.
//
// The rule: a new toast goes last. Sticky toasts (warnings the player must read, like a failed save) are never pushed
// out by later ones. Of the ordinary toasts, only the newest `keep` stay beside the new one. With `dedupe`, an older
// toast with the same text is dropped, so a repeat moves to the end instead of showing twice.

export type Toast<Tone extends string = string> = { id: number; text: string; tone?: Tone; sticky?: boolean };

export type ToastPolicy = {
    /** How many older ordinary toasts stay when a new one arrives (Groundbreak 1, Starwright 3). */
    keep: number;
    /** Drop an older toast with the same text. */
    dedupe?: boolean;
};

export function pushToast<T extends Toast<string>>(list: readonly T[], next: T, policy: ToastPolicy): T[] {
    const rest = policy.dedupe ? list.filter((x) => x.text !== next.text) : list;
    const sticky = rest.filter((x) => x.sticky);
    const plain = rest.filter((x) => !x.sticky);
    // stickies sit before the ordinary toasts, so a burst of news never hides a warning
    const kept = policy.keep > 0 ? plain.slice(-policy.keep) : [];
    return [...sticky, ...kept, next];
}

export const dropToast = <T extends Toast<string>>(list: readonly T[], id: number): T[] => list.filter((x) => x.id !== id);
