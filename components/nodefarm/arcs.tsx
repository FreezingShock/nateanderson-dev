"use client";

import type { CSSProperties } from "react";
import type { Arc } from "@/lib/nodefarm/arcs";
import { nfArt } from "@/lib/nodefarm/art-version";
import { arcCleared, arcProgress } from "@/lib/nodefarm/arcs";
import { button, isUnlocked, TIERS, TUNE, type ButtonStat, type StatId, type State } from "@/lib/nodefarm/engine";

/** Header for one arc of zones: name, a progress line and a fold button. */
export function ArcHead({ arc, no, s, open, onToggle }: { arc: Arc; no: number; s: State; open: boolean; onToggle: () => void }) {
    const online = arc.zones.filter((z) => isUnlocked(s, z as StatId)).length;
    const { built, total } = arcProgress(s, arc.zones);
    let ready = 0;
    for (const z of arc.zones) {
        if (z === "bytes" || !isUnlocked(s, z as StatId)) continue;
        for (let k = 0; k < TIERS; k++) {
            const b = button(s, z as ButtonStat, k);
            if ((s[b.pays] as number) >= b.cost) ready++;
        }
    }
    const pct = total ? Math.round((built / total) * 100) : 100;
    const cleared = arcCleared(s, arc);
    const bodyId = `nf-arc-${arc.id}`;
    return (
        <header className="nf-arc" data-open={open ? "true" : "false"} data-ready={!open && ready > 0 ? "" : undefined} style={{ ["--c" as string]: arc.color, ...(arc.scene !== undefined ? { ["--arc-art" as string]: `url(${nfArt(`scene-${arc.scene}.webp`)})` } : {}) } as CSSProperties}>
            <button type="button" className="nf-arc-b" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
                <span className="nf-arc-k">ARC {String(no).padStart(2, "0")} // {arc.name.toUpperCase()}</span>
                <span className="nf-arc-s">{online}/{arc.zones.length} zones online{!open && ready > 0 ? ` · ${ready} ready` : ""}</span>
                <span className="nf-arc-i" aria-hidden="true"><i /></span>
                <span className="nf-arc-p" data-done={cleared ? "" : undefined} role="progressbar" aria-label={`${arc.name}: ${built} of ${total} buttons pressed`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} />{[25, 50, 75].map((m) => <b key={m} aria-hidden="true" style={{ left: `${m}%` }} data-hit={pct >= m ? "" : undefined} />)}</span>
                <span className="nf-arc-d">{arc.blurb} {built}/{total} buttons pressed. {cleared ? `Cleared: ×${(1 + TUNE.arcBonus).toFixed(2)} global.` : `Press every button once for ×${(1 + TUNE.arcBonus).toFixed(2)} global.`}</span>
            </button>
        </header>
    );
}
