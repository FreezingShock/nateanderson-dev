"use client";

import type { CSSProperties } from "react";
import { ARCS, arcCleared, arcProgress } from "@/lib/nodefarm/zones/arcs";
import { isUnlocked, type StatId, type State } from "@/lib/nodefarm/engine";
import { readyCount } from "@/lib/nodefarm/layout";

const info = (s: State, id: string) => {
    const i = ARCS.findIndex((a) => a.id === id);
    const arc = ARCS[i];
    const online = arc.zones.filter((z) => isUnlocked(s, z as StatId)).length;
    const ready = arc.zones.reduce((n, z) => n + readyCount(s, z as StatId), 0);
    const { built, total } = arcProgress(s, arc.zones);
    return { arc, no: String(i + 1).padStart(2, "0"), online, ready, pct: total ? Math.round((built / total) * 100) : 100, cleared: arcCleared(s, arc) };
};

/** The arc rail: one cell per arc on the board. Only the picked arc's zones render under it (Nate's pick, 2026-11-12). */
export function ArcRail({ s, arcs, sel, onPick }: { s: State; arcs: string[]; sel: string; onPick: (id: string) => void }) {
    if (arcs.length < 2) return null;
    return (
        <nav className="nf-rail" aria-label="Arcs" style={{ ["--n" as string]: arcs.length } as CSSProperties}>
            {arcs.map((id) => {
                const x = info(s, id);
                const on = id === sel;
                return (
                    <button key={id} type="button" className="nf-rail-b" data-arc={id} aria-current={on ? "true" : undefined} data-ready={x.ready ? "" : undefined} data-done={x.cleared ? "" : undefined} onClick={() => onPick(id)} style={{ ["--c" as string]: x.arc.color } as CSSProperties} aria-label={`Arc ${x.no}, ${x.arc.name}: ${x.online} of ${x.arc.zones.length} zones online${x.ready ? `, ${x.ready} buttons ready` : ""}`}>
                        <span className="nf-rail-k">ARC {x.no}</span>
                        <b>{x.arc.name}</b>
                        <small>{x.ready ? `${x.ready} ready` : x.cleared ? "cleared" : `${x.online}/${x.arc.zones.length} online`}</small>
                        <i className="nf-rail-p" aria-hidden="true"><i style={{ width: `${x.pct}%` }} /></i>
                    </button>
                );
            })}
        </nav>
    );
}

/** Under the open arc: step to the arc before or after without scrolling back up to the rail. */
export function ArcStep({ s, arcs, sel, onPick }: { s: State; arcs: string[]; sel: string; onPick: (id: string) => void }) {
    const i = arcs.indexOf(sel);
    if (arcs.length < 2 || i < 0) return null;
    const prev = i > 0 ? info(s, arcs[i - 1]) : null;
    const next = i < arcs.length - 1 ? info(s, arcs[i + 1]) : null;
    return (
        <div className="nf-arcstep">
            {prev ? (
                <button type="button" className="nf-arcstep-b" data-ready={prev.ready ? "" : undefined} style={{ ["--c" as string]: prev.arc.color } as CSSProperties} onClick={() => onPick(prev.arc.id)}>
                    <span aria-hidden="true">‹ Q</span> ARC {prev.no} // {prev.arc.name.toUpperCase()}{prev.ready ? ` · ${prev.ready} ready` : ""}
                </button>
            ) : <span />}
            {next && (
                <button type="button" className="nf-arcstep-b" data-ready={next.ready ? "" : undefined} style={{ ["--c" as string]: next.arc.color } as CSSProperties} onClick={() => onPick(next.arc.id)}>
                    ARC {next.no} // {next.arc.name.toUpperCase()}{next.ready ? ` · ${next.ready} ready` : ""} <span aria-hidden="true">E ›</span>
                </button>
            )}
        </div>
    );
}
