"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

// The console's code and styles live in their own chunk. Nothing is fetched until the first time it is opened (key,
// header button, or the `cm:console` event), so it adds nothing to the first load.
const NaosConsole = dynamic(() => import("@/components/cm/console").then((m) => m.NaosConsole), { ssr: false });

export function openConsole() {
    window.dispatchEvent(new Event("cm:console"));
}

/** Opens the naOS command console with the backtick key (or ⌘/Ctrl + J), the header button, or `cm:console`. */
export function ConsoleEntry() {
    const [open, setOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const show = useCallback(() => {
        setLoaded(true);
        setOpen(true);
    }, []);
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
        window.addEventListener("cm:console", show);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("cm:console", show);
        };
    }, [show]);

    if (!loaded || !open) return null;
    return <NaosConsole onClose={hide} />;
}
