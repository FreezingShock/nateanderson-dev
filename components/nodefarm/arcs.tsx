"use client";

import type { CSSProperties } from "react";
import type { Arc } from "@/lib/nodefarm/arcs";
import { nfArt } from "@/lib/nodefarm/art-version";
import { button, isUnlocked, TIERS, type ButtonStat, type StatId, type State } from "@/lib/nodefarm/engine";

/** Header for one arc of zones: name, a progress line and a fold button. */
export function ArcHead({ arc, no, s, open, onToggle }: { arc: Arc; no: number; s: State; open: boolean; onToggle: () => void }) {
    const online = arc.zones.filter((z) => isUnlocked(s, z as StatId)).length;
    const btnZones = arc.zones.filter((z) => z !== "bytes") as ButtonStat[];
    const total = btnZones.length * TIERS;
    let built = 0;
    let ready = 0;
    for (const z of btnZones) {
        if (!isUnlocked(s, z as StatId)) continue;
        for (let k = 0; k < TIERS; k++) {
            if (s.bought[z][k] > 0) built++;
            const b = button(s, z, k);
            if ((s[b.pays] as number) >= b.cost) ready++;
        }
    }
    const pct = total ? Math.round((built / total) * 100) : 100;
    const bodyId = `nf-arc-${arc.id}`;
    return (
        <header className="nf-arc" data-open={open ? "true" : "false"} data-ready={!open && ready > 0 ? "" : undefined} style={{ ["--c" as string]: arc.color, ...(arc.scene !== undefined ? { ["--arc-art" as string]: `url(${nfArt(`scene-${arc.scene}.webp`)})` } : {}) } as CSSProperties}>
            <button type="button" className="nf-arc-b" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
                <span className="nf-arc-k">ARC {String(no).padStart(2, "0")} // {arc.name.toUpperCase()}</span>
                <span className="nf-arc-s">{online}/{arc.zones.length} zones online{!open && ready > 0 ? ` · ${ready} ready` : ""}</span>
                <span className="nf-arc-i" aria-hidden="true"><i /></span>
                <span className="nf-arc-p" role="progressbar" aria-label={`${arc.name}: ${built} of ${total} buttons built`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
                <span className="nf-arc-d">{arc.blurb} {built}/{total} buttons built.</span>
            </button>
        </header>
    );
}
