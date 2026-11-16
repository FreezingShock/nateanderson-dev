"use client";

// Window behaviour shared by game menus: close with an exit animation, Escape to close, and a modal focus trap.
// Headless; GameWindow (./game-window.tsx) and Brasswork's MenuWindow both use these.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Close after the exit animation: `requestClose()` sets `closing` (point your CSS exit at it) and calls `onClose`
 * after `exitMs`. A second request while closing is ignored. With `escape` (default on), Escape requests a close.
 */
export function useWindowClose(onClose: () => void, { exitMs = 160, escape = true }: { exitMs?: number; escape?: boolean } = {}) {
    const [closing, setClosing] = useState(false);
    const timer = useRef<number | null>(null);

    const requestClose = useCallback(() => {
        if (timer.current !== null) return;
        setClosing(true);
        timer.current = window.setTimeout(() => {
            timer.current = null;
            onClose();
        }, exitMs);
    }, [onClose, exitMs]);

    useEffect(() => {
        if (!escape) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [requestClose, escape]);

    useEffect(
        () => () => {
            if (timer.current !== null) window.clearTimeout(timer.current);
        },
        [],
    );

    return { closing, requestClose };
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Modal focus: on mount focus moves into `ref`, Tab and Shift+Tab stay inside it, and on unmount focus goes back to
 * whatever had it before. Pass `enabled: false` for a non-modal panel.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, enabled = true): void {
    useEffect(() => {
        if (!enabled) return;
        const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const el = ref.current;
        el?.focus({ preventScroll: true });
        const trap = (e: KeyboardEvent) => {
            if (e.key !== "Tab" || !el) return;
            const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null && !n.hasAttribute("disabled"));
            if (items.length === 0) return;
            const first = items[0];
            const last = items[items.length - 1];
            const at = document.activeElement;
            if (!el.contains(at) || at === el) {
                e.preventDefault();
                (e.shiftKey ? last : first).focus();
            } else if (e.shiftKey && at === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && at === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", trap);
        return () => {
            window.removeEventListener("keydown", trap);
            if (back && document.contains(back)) back.focus({ preventScroll: true });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);
}

/**
 * Keyboard and ARIA for a row of tabs: arrow keys (and Home/End) move between tabs, the selected tab is the only one in
 * the Tab order. Spread `tabProps(id)` on each tab button and `panelProps(id)` on its panel.
 */
export function useTabs<T extends string>(ids: readonly T[], value: T, onChange: (id: T) => void, prefix = "gk") {
    const refs = useRef(new Map<T, HTMLButtonElement | null>());
    const move = (from: T, step: number | "first" | "last") => {
        const i = ids.indexOf(from);
        const n = step === "first" ? 0 : step === "last" ? ids.length - 1 : (i + step + ids.length) % ids.length;
        const next = ids[n];
        onChange(next);
        refs.current.get(next)?.focus();
    };
    const tabProps = (id: T) => ({
        ref: (el: HTMLButtonElement | null) => {
            refs.current.set(id, el);
        },
        id: `${prefix}-tab-${id}`,
        role: "tab" as const,
        type: "button" as const,
        "aria-selected": value === id,
        "aria-controls": `${prefix}-panel-${id}`,
        tabIndex: value === id ? 0 : -1,
        onClick: () => onChange(id),
        onKeyDown: (e: React.KeyboardEvent) => {
            const k = e.key;
            if (k === "ArrowRight" || k === "ArrowDown") move(id, 1);
            else if (k === "ArrowLeft" || k === "ArrowUp") move(id, -1);
            else if (k === "Home") move(id, "first");
            else if (k === "End") move(id, "last");
            else return;
            e.preventDefault();
        },
    });
    const panelProps = (id: T) => ({ id: `${prefix}-panel-${id}`, role: "tabpanel" as const, "aria-labelledby": `${prefix}-tab-${id}`, hidden: value !== id });
    return { listProps: { role: "tablist" as const }, tabProps, panelProps };
}
