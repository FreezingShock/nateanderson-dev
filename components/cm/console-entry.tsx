"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// The console's code and styles live in their own chunk. Nothing is fetched until the first time it is opened (key,
// header button, or the `cm:console` event), so it adds nothing to the first load.
const NaosConsole = dynamic(() => import("@/components/cm/console").then((m) => m.NaosConsole), { ssr: false });

/** Opens the console. `prefill` puts a command in the input without running it. */
export function openConsole(prefill?: string) {
    window.dispatchEvent(new CustomEvent<{ prefill?: string }>("cm:console", { detail: { prefill } }));
}

/** Opens the naOS command console with the backtick key (or ⌘/Ctrl + J), the header button, or `cm:console`. */
export function ConsoleEntry() {
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [prefill, setPrefill] = useState<string | undefined>(undefined);

    const show = useCallback((p?: string) => {
        setPrefill(p);
        setLoaded(true);
        setOpen(true);
    }, []);
    const onEvent = useCallback((e: Event) => show((e as CustomEvent<{ prefill?: string }>).detail?.prefill), [show]);
    const hide = useCallback(() => setOpen(false), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const typing = !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
            const tick = e.key === "`" || e.code === "Backquote";
            if (tick && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                show();
            } else if ((e.key === "j" || e.key === "J") && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
                e.preventDefault();
                setOpen((o) => !o);
                setLoaded(true);
            }
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("cm:console", onEvent);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("cm:console", onEvent);
        };
    }, [show, onEvent]);

    if (!loaded || !open) return null;
    return <NaosConsole onClose={hide} prefill={prefill} />;
}
