// Groundbreak site scene built from the drawn art, for the page's scene slot (UI-SCENE-SLOT.md). Same props as
// components/groundbreak/scene.tsx: the page owns input and camera; this only draws.
"use client";

import { useEffect, useRef, useState } from "react";
import { GbJob } from "./index";
import { GB_BACKDROP, GB_JOBS, type GbJobId } from "./scene-data";

// Structural copy of components/groundbreak/scene-types.ts (kept local so the art folder has no import into the UI).
type Camera = { x: number; y: number; z: number };
type SceneJob = { id: string; floors: number; frac: number; phase: number; phaseName: string; phaseCount: number; inspecting: boolean; inspect: number };
type SceneBuilding = { id: string; firm: number; index: number };
export type GbSiteSceneProps = { camera: Camera; job: SceneJob | null; skyline: SceneBuilding[]; craneLevel: number; reduce: boolean; paused: boolean };

/** World (480 x 270, ground 214) to art pixels: one world unit is K art pixels. */
const WORLD_W = 480;
const WORLD_H = 270;
const GROUND_Y = 214;
const K = 2;
/** The job stands with its centre at world x 240 on the near shore; the backdrop's site line meets world ground. */
const OY = GB_BACKDROP.siteY - GROUND_Y * K;
const SITE_X = 980; // backdrop x (art px) under the job's centre: right of the port cranes, the city behind it
const PARALLAX = { sky: 0.06, hills: 0.22, city: 0.42, bay: 0.62, shore: 1 } as const;

function frameFor(id: GbJobId, job: SceneJob): number {
    const n = GB_JOBS[id].frames.length;
    if (job.inspecting) return job.inspect >= 1 ? n - 1 : n - 2;
    // lot .. second-to-last spread over the build; "done" only once inspection passes
    return Math.min(n - 2, Math.floor(job.frac * (n - 2)));
}

export function GbSiteScene({ camera, job, skyline, reduce, paused }: GbSiteSceneProps) {
    const box = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ w: 1440, h: 810 });
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const { w: cw, h: ch } = size;
    const fit = Math.max(cw / (WORLD_W * K), ch / (WORLD_H * K));
    const s = fit * camera.z;
    // camera centre in art px of the near plane
    const fx = SITE_X + (camera.x - WORLD_W / 2) * K;
    const fy = OY + camera.y * K;
    const B = GB_BACKDROP;
    const city = Math.min(4, Math.floor(skyline.length / 3)) as 0 | 1 | 2 | 3 | 4;

    const layer = (name: keyof typeof PARALLAX, src: string) => {
        const p = PARALLAX[name];
        const sc = fit * (1 + (camera.z - 1) * p);
        const cx = SITE_X + (fx - SITE_X) * p;
        const tx = cw / 2 - cx * sc;
        // every layer keeps the horizon on the same screen line as the near plane, so no seams open between them
        const horizonScreen = ch / 2 + (B.horizon - fy) * s;
        const ty = horizonScreen - B.horizon * sc;
        // three copies side by side so zooming far out never shows an edge
        return (
            <div key={name} className="gba-layer" style={{
                width: B.w * 3, height: B.h, transform: `translate(${tx - B.w * sc}px, ${ty}px) scale(${sc})`,
                backgroundImage: `url("${src}")`, backgroundSize: `${B.w}px ${B.h}px`, backgroundRepeat: "repeat-x",
            }} />
        );
    };

    const id = job && job.id in GB_JOBS ? (job.id as GbJobId) : null;
    const near = `translate(${cw / 2 - fx * s}px, ${ch / 2 - fy * s}px) scale(${s})`;
    // finished buildings line the shore to the right of the site, newest nearest; one of each kind per firm
    const seen = new Set<string>();
    const done = [...skyline].reverse().filter((b) => b.id in GB_JOBS && !seen.has(`${b.id}`) && seen.add(`${b.id}`)).slice(0, 12);
    let x = SITE_X + (id ? GB_JOBS[id].w / 2 : 120) + 30;
    const left: { id: GbJobId; x: number }[] = [];
    for (const b of done) {
        const j = GB_JOBS[b.id as GbJobId];
        left.push({ id: b.id as GbJobId, x });
        x += Math.round(j.w * 0.8);
    }

    return (
        <div ref={box} className={`gba-scene ${reduce ? "gba-lowfx" : ""} ${paused ? "gba-paused" : ""}`} aria-hidden="true">
            {layer("sky", B.layers.sky)}
            {layer("hills", B.layers.hills)}
            {layer("city", B.layers[`city-${city}`])}
            {layer("bay", B.layers.bay)}
            {layer("shore", B.layers.shore)}
            <div className="gba-near" style={{ transform: near }}>
                <div className="gba-under" style={{ left: -4000, top: B.h - 2, width: B.w + 8000, height: 3000 }} />
                {left.map((b) => {
                    const j = GB_JOBS[b.id];
                    return <GbJob key={b.id} job={b.id} frame={j.frames.length - 1}
                        style={{ position: "absolute", left: b.x, top: B.siteY + j.ground - j.h }} />;
                })}
                {id && (() => {
                    const j = GB_JOBS[id];
                    const left0 = SITE_X - j.w / 2;
                    const top0 = B.siteY + j.ground - j.h;
                    return (
                        <>
                            <GbJob job={id} frame={frameFor(id, job!)} style={{ position: "absolute", left: left0, top: top0 }} />
                            {job!.inspecting && job!.inspect < 1 && (
                                <div className="gba-flag" style={{ left: SITE_X + j.w / 2 - 34, top: B.siteY - 30 }} />
                            )}
                            {!reduce && <div className="gba-dust" style={{ left: left0, top: B.siteY - 40, width: j.w }} />}
                        </>
                    );
                })()}
            </div>
        </div>
    );
}

export default GbSiteScene;
