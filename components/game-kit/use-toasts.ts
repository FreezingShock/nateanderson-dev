"use client";

// useToasts: the toast queue (lib/game-kit/toasts) plus its timers. Each toast leaves on its own after `ttlMs`
// (`stickyTtlMs` for sticky warnings). Render the list with <ToastStack> or the game's own markup.
import { useCallback, useEffect, useRef, useState } from "react";
import { dropToast, pushToast, type Toast, type ToastPolicy } from "@/lib/game-kit/toasts";

export type ToastOptions = ToastPolicy & {
    /** How long an ordinary toast stays (ms). */
    ttlMs: number;
    /** How long a sticky toast stays (ms). Defaults to ttlMs. */
    stickyTtlMs?: number;
};

export function useToasts<Tone extends string = string>(opts: ToastOptions) {
    const [toasts, setToasts] = useState<Toast<Tone>[]>([]);
    const id = useRef(0);
    const timers = useRef(new Set<number>());
    const { keep, dedupe, ttlMs, stickyTtlMs } = opts;

    const push = useCallback(
        (text: string, tone?: Tone, sticky = false) => {
            const next: Toast<Tone> = { id: ++id.current, text, tone, sticky };
            setToasts((list) => pushToast(list, next, { keep, dedupe }));
            const t = window.setTimeout(() => {
                timers.current.delete(t);
                setToasts((list) => dropToast(list, next.id));
            }, sticky ? (stickyTtlMs ?? ttlMs) : ttlMs);
            timers.current.add(t);
            return next.id;
        },
        [keep, dedupe, ttlMs, stickyTtlMs],
    );

    const dismiss = useCallback((toastId: number) => setToasts((list) => dropToast(list, toastId)), []);

    useEffect(() => {
        const set = timers.current;
        return () => set.forEach((t) => window.clearTimeout(t));
    }, []);

    return { toasts, push, dismiss };
}
