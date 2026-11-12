"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { FeedLine, FeedStore, Tok } from "@/lib/nodefarm/feed";

const ROWS = 8;
const CHARS_PER_STEP = 2;
const STEP_MS = 22;

function Toks({ toks, upTo = Infinity }: { toks: Tok[]; upTo?: number }) {
    let left = upTo;
    const out: React.ReactNode[] = [];
    for (let i = 0; i < toks.length && left > 0; i++) {
        const t = toks[i];
        const v = t.v.length > left ? t.v.slice(0, left) : t.v;
        left -= v.length;
        out.push(<span key={i} data-k={t.k} style={t.c ? ({ ["--tc" as string]: t.c } as CSSProperties) : undefined}>{v}</span>);
    }
    return <>{out}</>;
}

/** Types a line out a couple of characters at a time. Always finishes: the timer stops itself, and reduced motion skips it. */
function Typed({ toks, reduced }: { toks: Tok[]; reduced: boolean }) {
    const total = toks.reduce((n, t) => n + t.v.length, 0);
    const [k, setK] = useState(reduced ? total : 0);
    useEffect(() => {
        if (reduced) return;
        const iv = setInterval(() => setK((x) => (x + CHARS_PER_STEP >= total ? total : x + CHARS_PER_STEP)), STEP_MS);
        return () => clearInterval(iv);
    }, [reduced, total]);
    return <Toks toks={toks} upTo={k} />;
}

export function Feed({ store, reduced }: { store: FeedStore; reduced: boolean }) {
    useSyncExternalStore(store.subscribe, store.getVersion, () => 0);
    const shown = store.lines.slice(-ROWS);
    const last = shown[shown.length - 1];
    return (
        <ol className="nf-log" aria-label="Event log" role="log" aria-live="off">
            {shown.map((l: FeedLine) => (
                <li key={l.id} data-tone={l.tone} data-new={l === last && !reduced && !l.type ? "" : undefined}>
                    <time>{l.t}</time>
                    <span className="nf-ln">{l === last && l.type ? <Typed toks={l.toks} reduced={reduced} /> : <Toks toks={l.toks} />}</span>
                </li>
            ))}
        </ol>
    );
}
