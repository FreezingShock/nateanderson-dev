"use client";

// Built-in Groundbreak site scene: a golden-hour dithered backdrop, a skyline made of every building finished so far, and the
// current job rising in four stages (foundation, steel frame, glass skin, fit-out) with a swinging tower crane, workers, sparks and
// dust. Drawn on one canvas in art pixels (480 x 270 world units) and scaled by the camera, so zooming keeps pixels sharp.
import { useEffect, useRef } from "react";
import { GROUND_Y, WORLD_H, WORLD_W, type SceneProps } from "./scene-types";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const SKY = ["#1a1226", "#3a1f3a", "#6b2f45", "#a8454a", "#d9693a", "#f09a3e", "#f7c860", "#fbe4a0"].map(hex);

function paintSky(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = WORLD_W; c.height = WORLD_H;
    const g = c.getContext("2d")!;
    const img = g.createImageData(WORLD_W, WORLD_H);
    for (let y = 0; y < WORLD_H; y++) {
        const t = Math.min(1, y / (GROUND_Y - 6)) * (SKY.length - 1);
        const lo = Math.floor(t), hi = Math.min(SKY.length - 1, lo + 1), f = t - lo;
        for (let x = 0; x < WORLD_W; x++) {
            const pick = f * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? hi : lo;
            const col = SKY[pick], i = (y * WORLD_W + x) * 4;
            img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
        }
    }
    g.putImageData(img, 0, 0);
    // sun, low behind the skyline
    g.fillStyle = "#fff0b8"; g.beginPath(); g.arc(352, 188, 22, 0, 7); g.fill();
    g.fillStyle = "#fbe4a0"; g.beginPath(); g.arc(352, 188, 30, 0, 7); g.globalAlpha = 0.25; g.fill(); g.globalAlpha = 1;
    return c;
}

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

function paintSkyline(skyline: SceneProps["skyline"]): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = WORLD_W; c.height = WORLD_H;
    const g = c.getContext("2d")!;
    const far = rng(7);
    g.fillStyle = "#4a2a47";
    for (let x = -4; x < WORLD_W; ) { const w = 10 + far() * 18, h = 20 + far() * 46; g.fillRect(x, GROUND_Y - h, w, h); x += w + 1; }
    g.fillStyle = "#34203c";
    const mid = rng(21);
    for (let x = -6; x < WORLD_W; ) {
        const w = 14 + mid() * 20, h = 26 + mid() * 58; g.fillRect(x, GROUND_Y - h, w, h);
        g.fillStyle = "#f0b04a";
        for (let wy = GROUND_Y - h + 4; wy < GROUND_Y - 6; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (mid() > 0.72) g.fillRect(wx, wy, 2, 2);
        g.fillStyle = "#34203c";
        x += w + 2;
    }
    // your buildings: the skyline you keep. Placed left to right across the back, newer firms taller and lit.
    const n = skyline.length;
    skyline.forEach((b, i) => {
        const r = rng(hash(b.id) + i * 97);
        const slot = (i % 18) / 18;
        const w = 12 + r() * 12, h = 30 + r() * 40 + b.firm * 4 + Math.floor(i / 18) * 10;
        const x = 6 + slot * (WORLD_W - 40) + r() * 8;
        g.fillStyle = "#241632"; g.fillRect(x, GROUND_Y - h, w, h);
        g.fillStyle = "#3c2a4c"; g.fillRect(x, GROUND_Y - h, 2, h);
        g.fillStyle = "#ffd36a";
        for (let wy = GROUND_Y - h + 3; wy < GROUND_Y - 5; wy += 4) for (let wx = x + 3; wx < x + w - 2; wx += 4) if (r() > 0.35) g.fillRect(wx, wy, 2, 2);
        g.fillStyle = "#f09a3e"; g.fillRect(x + w / 2 - 1, GROUND_Y - h - 4, 2, 4);
    });
    void n;
    // ground
    const strata = ["#4a3426", "#3e2c21", "#33241b", "#2a1e17"];
    strata.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, GROUND_Y + k * 14, WORLD_W, 14); });
    g.fillStyle = "#6b6f78"; g.fillRect(0, GROUND_Y + 9, WORLD_W, 2); g.fillStyle = "#4f94b0"; g.fillRect(0, GROUND_Y + 24, WORLD_W, 2); // sewer and water main
    g.fillStyle = "#d9b04a"; g.fillRect(0, GROUND_Y + 34, WORLD_W, 1); // gas line
    g.fillStyle = "#5a4030";
    const gr = rng(3);
    for (let i = 0; i < 360; i++) g.fillRect(gr() * WORLD_W, GROUND_Y + 2 + gr() * (WORLD_H - GROUND_Y - 2), 2 + gr() * 3, 1);
    g.fillStyle = "#7a5a3c"; g.fillRect(0, GROUND_Y, WORLD_W, 2);
    return c;
}

type JobGeom = { x: number; w: number; fh: number; top: number };
function geom(floors: number): JobGeom {
    const w = Math.min(130, Math.max(44, 40 + floors * 5));
    const fh = Math.min(18, 170 / Math.max(1, floors));
    return { x: 232 - w / 2, w, fh, top: GROUND_Y - fh * floors };
}

export function GroundbreakScene(props: SceneProps) {
    const ref = useRef<HTMLCanvasElement>(null);
    const live = useRef(props);
    live.current = props;
    const skyRef = useRef<HTMLCanvasElement | null>(null);
    const lineRef = useRef<{ key: string; c: HTMLCanvasElement } | null>(null);
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const cv = ref.current, host = hostRef.current;
        if (!cv || !host) return;
        const ctx = cv.getContext("2d")!;
        skyRef.current = paintSky();
        let raf = 0, last = 0, W = 0, H = 0;
        const parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
        const resize = () => {
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const r = host.getBoundingClientRect();
            W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
            cv.width = W; cv.height = H;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(host);
        resize();
        const t0 = performance.now();
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (document.hidden) return;
            const p = live.current;
            if (now - last < (p.reduce ? 120 : 30)) return;
            const dt = Math.min(0.1, (now - last) / 1000); last = now;
            const t = p.paused ? 0 : (now - t0) / 1000;
            const key = p.skyline.map((b) => b.id).join(",");
            if (!lineRef.current || lineRef.current.key !== key) lineRef.current = { key, c: paintSkyline(p.skyline) };
            const cover = Math.max(W / WORLD_W, H / WORLD_H);
            const sc = cover * p.camera.z;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = "#1a1226"; ctx.fillRect(0, 0, W, H);
            const tx = W / 2 - p.camera.x * sc, ty = H / 2 - p.camera.y * sc;
            ctx.setTransform(sc, 0, 0, sc, tx, ty);
            // sky is drawn oversized so panning and zooming out never shows an edge
            const sky = skyRef.current!;
            ctx.drawImage(sky, -WORLD_W, 0, WORLD_W, WORLD_H); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(sky, -WORLD_W * 2, 0, WORLD_W, WORLD_H); ctx.restore();
            ctx.drawImage(sky, 0, 0); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(sky, -WORLD_W * 2, 0, WORLD_W, WORLD_H); ctx.restore();
            ctx.fillStyle = "#1a1226"; ctx.fillRect(-WORLD_W, -400, WORLD_W * 3, 400);
            ctx.fillStyle = "#3a2a20"; ctx.fillRect(-WORLD_W, GROUND_Y, WORLD_W * 3, 400);
            ctx.drawImage(lineRef.current.c, 0, 0);
            drawSite(ctx, p, t, parts, dt);
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        };
        raf = requestAnimationFrame(loop);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }, []);

    return (
        <div ref={hostRef} className="gb-scene">
            <canvas ref={ref} className="gb-scene-canvas" role="img" aria-label={props.job ? `A building under construction, ${Math.round(props.job.frac * 100)} percent done` : "An empty building site at golden hour"} />
        </div>
    );
}

function drawSite(ctx: CanvasRenderingContext2D, p: SceneProps, t: number, parts: { x: number; y: number; vx: number; vy: number; life: number; c: string }[], dt: number) {
    const job = p.job;
    const floors = job?.floors ?? 3;
    const g = geom(floors);
    const reduce = p.reduce;
    // site fence and gravel pile
    ctx.fillStyle = "#6b5a48";
    for (let x = 20; x < 460; x += 6) ctx.fillRect(x, GROUND_Y - 5, 1, 5);
    ctx.fillStyle = "#8a7660"; ctx.fillRect(20, GROUND_Y - 5, 440, 1);
    ctx.fillStyle = "#c9b79a"; ctx.beginPath(); ctx.moveTo(40, GROUND_Y); ctx.lineTo(60, GROUND_Y - 12); ctx.lineTo(82, GROUND_Y); ctx.fill();
    ctx.fillStyle = "#a9adb3"; ctx.fillRect(400, GROUND_Y - 6, 22, 6); ctx.fillStyle = "#8f98a6"; ctx.fillRect(404, GROUND_Y - 10, 14, 4);

    const f = job ? job.frac : 0;
    const stage = !job ? -1 : job.inspecting ? 4 : f < 0.22 ? 0 : f < 0.55 ? 1 : f < 0.8 ? 2 : 3;
    let craneTop = GROUND_Y - 70;
    if (job) {
        // stage progress within the stage, 0 to 1
        const lo = [0, 0.22, 0.55, 0.8][Math.min(stage, 3)], hi = [0.22, 0.55, 0.8, 1][Math.min(stage, 3)];
        const sp = stage >= 4 ? 1 : Math.max(0, Math.min(1, (f - lo) / (hi - lo)));
        const built = stage >= 1 ? 1 : 0;
        // foundation pit and slab
        ctx.fillStyle = "#1b120e"; ctx.fillRect(g.x - 6, GROUND_Y, g.w + 12, stage === 0 ? 12 : 8);
        ctx.fillStyle = "#a9adb3"; for (let px = g.x; px <= g.x + g.w; px += Math.max(8, g.w / 5)) ctx.fillRect(px, GROUND_Y + 8, 2, stage >= 1 ? 22 : Math.round(22 * Math.min(1, f * 6))); // piles
        if (stage === 0) {
            ctx.fillStyle = "#c9b79a"; ctx.fillRect(g.x, GROUND_Y + 1, g.w * sp, 3);
            ctx.fillStyle = "#d9742f"; for (let x = g.x; x < g.x + g.w * sp; x += 4) ctx.fillRect(x, GROUND_Y - 1, 1, 2);
        } else { ctx.fillStyle = "#a9adb3"; ctx.fillRect(g.x - 2, GROUND_Y, g.w + 4, 3); }
        const fl = floors;
        const frameFloors = stage === 0 ? 0 : stage === 1 ? Math.max(1, Math.round(fl * sp)) : fl;
        const skinFloors = stage < 2 ? 0 : stage === 2 ? Math.round(fl * sp) : fl;
        const litFloors = stage < 3 ? 0 : stage === 3 ? Math.round(fl * sp) : fl;
        const cols = Math.max(3, Math.round(g.w / 14));
        for (let k = 0; k < frameFloors; k++) {
            const y = GROUND_Y - g.fh * (k + 1);
            // cutaway: the back wall and rooms behind the cut face
            const lit = k < litFloors;
            ctx.fillStyle = lit ? "#4a3326" : "#2c2230"; ctx.fillRect(g.x, y + 2, g.w, g.fh - 2);
            ctx.fillStyle = lit ? "#6a4a30" : "#3a2f42";
            for (let c = 1; c < cols; c++) ctx.fillRect(Math.round(g.x + (g.w * c) / cols), y + 2, 1, g.fh - 2);
            if (lit) { ctx.fillStyle = "#ffd36a"; for (let c = 0; c < cols; c++) { const rx = g.x + (g.w * c) / cols; ctx.fillRect(rx + 3, y + g.fh - 4, 4, 2); if ((c + k) % 3 === 0) ctx.fillRect(rx + 9, y + 4, 2, 2); } }
            else if (k < skinFloors) { ctx.fillStyle = "#c2621f"; ctx.fillRect(g.x + g.w * 0.3, y + g.fh - 3, 5, 1); }
            // floor slab
            ctx.fillStyle = "#9aa2ae"; ctx.fillRect(g.x - 1, y, g.w + 2, 2);
            // columns (safety-orange steel until skinned)
            ctx.fillStyle = k < skinFloors ? "#5a6574" : "#e07a2a";
            for (let c = 0; c <= cols; c++) ctx.fillRect(g.x + (g.w - 2) * (c / cols), y, 2, g.fh);
            // diagonal bracing on the frame
            if (k >= skinFloors && g.fh > 6) { ctx.fillStyle = "#c2621f"; for (let c = 0; c < cols; c += 2) ctx.fillRect(g.x + (g.w - 2) * (c / cols) + 3, y + g.fh / 2, 4, 1); }
            if (k < skinFloors) {
                // glass skin: closed on both side walls, a thin pane over the cut face
                ctx.fillStyle = "#8fb3c2"; ctx.fillRect(g.x, y + 2, 3, g.fh - 2); ctx.fillRect(g.x + g.w - 3, y + 2, 3, g.fh - 2);
                ctx.fillStyle = "rgba(143,179,194,0.22)"; ctx.fillRect(g.x + 3, y + 2, g.w - 6, g.fh - 2);
                ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(g.x + 3, y + 2, g.w - 6, 1);
            }
        }
        if (stage === 4 || (stage === 3 && sp > 0.98)) {
            ctx.fillStyle = "#4a4e5a"; ctx.fillRect(g.x - 1, g.top - 2, g.w + 2, 2);
            // inspection flag
            const ok = job.inspecting;
            if (ok) { ctx.fillStyle = "#e8e0d0"; ctx.fillRect(g.x + g.w / 2, g.top - 16, 1, 14); ctx.fillStyle = "#7fd06a"; ctx.fillRect(g.x + g.w / 2 + 1, g.top - 16, 8, 5 + (reduce ? 0 : Math.round(Math.sin(t * 4))), ); }
        }
        void built;
        craneTop = Math.min(GROUND_Y - 60, GROUND_Y - g.fh * frameFloors - 40);
        // sparks while welding, dust while pouring
        if (!reduce && !p.paused && stage <= 1 && Math.random() < 0.6) {
            const y0 = stage === 0 ? GROUND_Y - 2 : GROUND_Y - g.fh * frameFloors;
            parts.push({ x: g.x + Math.random() * g.w, y: y0, vx: (Math.random() - 0.5) * 20, vy: -10 - Math.random() * 18, life: 0.8, c: stage === 1 ? "#ffd36a" : "#c9b79a" });
        }
    } else {
        // empty lot: surveyor stakes and a sign
        ctx.fillStyle = "#e07a2a"; for (let x = g.x; x < g.x + g.w; x += 14) ctx.fillRect(x, GROUND_Y - 8, 1, 8);
        ctx.fillStyle = "#e8e0d0"; ctx.fillRect(g.x, GROUND_Y - 9, g.w, 1);
    }
    // tower crane
    const cx = 338, mastTop = Math.max(34, craneTop - 28);
    ctx.fillStyle = "#f0b04a"; for (let y = GROUND_Y; y > mastTop; y -= 4) { ctx.fillRect(cx, y - 4, 1, 4); ctx.fillRect(cx + 4, y - 4, 1, 4); if ((y / 4) % 2) ctx.fillRect(cx + 1, y - 2, 3, 1); }
    const sw = reduce || p.paused ? 0 : Math.sin(t * 0.5);
    const jibL = 120 + p.craneLevel * 6, jibR = 28;
    ctx.fillStyle = "#f0b04a"; ctx.fillRect(cx - jibL, mastTop, jibL + jibR, 3);
    ctx.fillStyle = "#c2621f"; ctx.fillRect(cx - jibL, mastTop + 3, jibL + jibR, 1);
    ctx.fillStyle = "#6b6f78"; ctx.fillRect(cx + jibR - 14, mastTop + 3, 12, 8); // counterweight
    ctx.fillStyle = "#e8e0d0"; ctx.fillRect(cx - 1, mastTop - 6, 8, 6); // cab
    const hx = cx - 50 - jibL * 0.28 + sw * 22;
    const drop = 26 + (job ? (Math.sin(t * 0.7) * 0.5 + 0.5) * 36 : 14);
    ctx.fillStyle = "#222"; ctx.fillRect(hx, mastTop + 3, 1, drop);
    ctx.fillStyle = "#e8e0d0"; ctx.fillRect(hx - 2, mastTop + 3 + drop, 5, 2);
    if (job && !job.inspecting) { ctx.fillStyle = "#a9adb3"; ctx.fillRect(hx - 6, mastTop + 5 + drop, 13, 3); }
    // workers
    ctx.fillStyle = "#ffd36a";
    for (let i = 0; i < (job ? 5 : 2); i++) {
        const wx = 110 + i * 46 + (reduce ? 0 : Math.sin(t * 0.8 + i * 2) * 10);
        ctx.fillStyle = "#e07a2a"; ctx.fillRect(wx, GROUND_Y - 6, 3, 2);
        ctx.fillStyle = "#e8e0d0"; ctx.fillRect(wx, GROUND_Y - 4, 3, 3);
        ctx.fillStyle = "#3a2a20"; ctx.fillRect(wx, GROUND_Y - 1, 1, 1); ctx.fillRect(wx + 2, GROUND_Y - ((Math.floor(t * 4 + i) & 1) ? 1 : 0), 1, 1);
    }
    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 40 * dt;
        if (q.life <= 0) { parts.splice(i, 1); continue; }
        ctx.fillStyle = q.c; ctx.fillRect(q.x, q.y, 1, 1);
    }
    if (parts.length > 120) parts.splice(0, parts.length - 120);
}
