"use client";

// Node Farm codex window: an index of every system you have reached, and a reader that prints the picked entry in.
// Entries are data in lib/nodefarm/codex.ts (hidden until their system opens, numbers read from the engine). Desktop shows
// index and reader side by side; a phone shows the index, then one entry with a back button. Styles: app/camino/nodefarm-codex.css.
import { useEffect, useMemo, useRef, useState } from "react";
import { nfx } from "@/lib/nodefarm/sound";
import { codeReveal } from "@/lib/nodefarm/cx";
import { ENTRIES, ENTRY_BY, GROUPS, codexNew, codexSeen, markCodexSeen, unlocked, type Block, type CodexOpen } from "@/lib/nodefarm/codex";
import type { State } from "@/lib/nodefarm/engine";
import { DataLines, Frame } from "./win-kit";
import "@/app/camino/nodefarm-codex.css";

const COLOR = "#ff6b57";

function Body({ blocks }: { blocks: Block[] }) {
    return (
        <>
            {blocks.map((b, i) => {
                if ("p" in b) return <p key={i} className="nf-cdx-p">{b.p}</p>;
                if ("rows" in b) return <DataLines key={i} rows={b.rows} className="nf-cdx-dl" />;
                if ("list" in b) {
                    return (
                        <ul key={i} className="nf-cdx-ul">
                            {b.list.map(([k, v]) => <li key={k}><b>{k}</b> {v}</li>)}
                        </ul>
                    );
                }
                return <p key={i} className="nf-cdx-note">{b.note}</p>;
            })}
        </>
    );
}

export function CodexPanel({ s, shown, onOpen }: { s: State; shown: boolean; onOpen: (w: CodexOpen) => void }) {
    const list = unlocked(s);
    const [sel, setSel] = useState<string>(() => (codexNew(s)[0] ?? list[0])?.id ?? "buttons");
    const [view, setView] = useState<"list" | "entry">("list");
    const [, bump] = useState(0);
    const reader = useRef<HTMLDivElement>(null);
    const first = useRef(true);
    const seen = codexSeen();
    const entry = ENTRY_BY.get(sel) && ENTRY_BY.get(sel)!.gate(s) ? ENTRY_BY.get(sel)! : list[0];
    const body = useMemo(() => entry.body(s), [entry, s]); // eslint-disable-line react-hooks/exhaustive-deps

    // reading an entry marks it seen (only while the window is actually showing)
    useEffect(() => {
        if (shown && entry && !seen.has(entry.id)) { markCodexSeen(entry.id); bump((n) => n + 1); }
    }, [shown, entry?.id]); // eslint-disable-line react-hooks/exhaustive-deps
    // the entry prints in each time you pick another
    useEffect(() => {
        if (first.current) { first.current = false; return; }
        codeReveal(reader.current, { bare: true, rows: ":scope > *", ms: 300, sound: false });
    }, [entry?.id]);
    const total = ENTRIES.length;
    const fresh = list.filter((e) => !seen.has(e.id)).length;
    const pick = (id: string) => { setSel(id); setView("entry"); nfx("nfPage"); };

    return (
        <div className="nf-sys nf-wk nf-cdx" data-v={view}>
            <header className="nf-cdx-top" data-cx-i="0">
                <p className="nf-cdx-path">~/codex</p>
                <dl className="nf-cdx-read">
                    <div><dt>ENTRIES</dt><dd>{list.length}{list.length < total ? ` of ${total}` : ""}</dd></div>
                    <div><dt>NEW</dt><dd>{fresh}</dd></div>
                </dl>
                <p className="nf-cdx-lead">What each system does, written as you reach it. More entries open as the farm grows.</p>
            </header>
            <div className="nf-cdx-grid" data-cx-i="1">
                <nav className="nf-cdx-list" aria-label="Codex entries">
                    {GROUPS.map((g) => {
                        const es = list.filter((e) => e.group === g.id);
                        if (!es.length) return null;
                        return (
                            <section key={g.id} aria-label={g.label}>
                                <h3 className="nf-cdx-gh">{g.label}</h3>
                                <ul>
                                    {es.map((e) => (
                                        <li key={e.id}>
                                            <button type="button" aria-pressed={e.id === entry.id} data-new={seen.has(e.id) ? undefined : ""} onClick={() => pick(e.id)}>
                                                <span>{e.title}</span>
                                                {!seen.has(e.id) && <i className="nf-cdx-dot" aria-label="new" />}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        );
                    })}
                    {list.length < total && <p className="nf-cdx-more">{total - list.length} more {total - list.length === 1 ? "entry is" : "entries are"} encrypted.</p>}
                </nav>
                <Frame path={`codex/${entry.id}`} color={COLOR} className="nf-cdx-fr" aside={entry.where}>
                    <button type="button" className="nf-cdx-back" onClick={() => { setView("list"); nfx("nfPage"); }}>◂ all entries</button>
                    <div className="nf-cdx-body" ref={reader} aria-live="polite">
                        <h2 className="nf-cdx-h">{entry.title}</h2>
                        <Body blocks={body} />
                        {entry.open && (
                            <button type="button" className="nf-cdx-go" onClick={() => onOpen(entry.open!.win)}>{entry.open.label} ▸</button>
                        )}
                    </div>
                </Frame>
            </div>
        </div>
    );
}
