"use client";

import { useEffect, useState } from "react";
import { GbSiteScene } from "./site-scene";
import { GB_JOBS } from "./scene-data";

/** Dev preview of the site scene driven by query params (job, frac, inspect, z, x, y, built). */
export default function Preview() {
    const [q, setQ] = useState<URLSearchParams | null>(null);
    useEffect(() => setQ(new URLSearchParams(window.location.search)), []);
    if (!q) return null;
    const id = q.get("job") ?? "clinic";
    const frac = Number(q.get("frac") ?? 0.6);
    const inspect = q.get("inspect");
    const built = (q.get("built") ?? "").split(",").filter((b) => b in GB_JOBS).map((b, i) => ({ id: b, firm: 1, index: i }));
    return (
        <div style={{ position: "fixed", inset: 0 }}>
            <GbSiteScene
                camera={{ x: Number(q.get("x") ?? 240), y: Number(q.get("y") ?? 140), z: Number(q.get("z") ?? 1) }}
                job={{ id, floors: 1, frac, phase: 0, phaseName: "", phaseCount: 1, inspecting: inspect !== null, inspect: Number(inspect ?? 0) }}
                skyline={built} craneLevel={0} reduce={q.has("reduce")} paused={false} />
        </div>
    );
}
