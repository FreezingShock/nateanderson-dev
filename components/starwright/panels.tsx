"use client";

// The menus that open over the star: Almanac, Orbit, Constellations and Pulsar map, Menu, the birth-cloud picker, the visitor
// card and the ending. Each opens and closes with its own animation (data-kind in app/camino/starwright.css).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGameShell } from "@/components/games/shell/game-route-shell";
import { createSaveTools, readPickedFile } from "@/lib/games/save";
import { ACHIEVEMENTS, ACH_BONUS, CLOUDS, CODEX, CONSTELLATIONS, ELEMENTS, EVENT_STAY, type EventOpt, PLANETS, PLANET_STAGE_AT, PLANET_STAGE_BONUS, TUNE, type Perk } from "@/lib/starwright/data";
import { H, W, makeLayers, render, renderLayered, renderPlanetSprite, type SceneFrame } from "@/lib/starwright/art";
import { frameAt, initSprites, sprites } from "@/lib/starwright/sprites";
import { SAVE_VERSION, canPlanet, effects, eventOf, fmt, fmtAge, isSave, parse, planetStage, type State } from "@/lib/starwright/engine";
import { cloudArt, cssUrl } from "@/lib/starwright/ui-art";
import { sheetInfo, sheetUrl } from "@/lib/starwright/ui-sheets";
import { ElTile, Gl, Pic, dockOrigin, ui } from "./sw-ui";
import { settingUnits, useSettings } from "./settings";
import { Paged, useProbe } from "./paged";
import { SW_KEYS } from "@/lib/starwright/commands";

export const tools = createSaveTools<State>({ app: "starwright", version: SAVE_VERSION, validate: isSave });

export type Kind = "iris" | "shutter" | "wipe" | "settle";
const Corners = () => <><i className="sw-cn" data-c="tl" /><i className="sw-cn" data-c="tr" /><i className="sw-cn" data-c="bl" /><i className="sw-cn" data-c="br" /></>;

export function Overlay({ title, sub, onClose, children, wide, kind, leaving }: { title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; kind: Kind; leaving?: boolean }) {
    const card = useRef<HTMLDivElement | null>(null);
    // The card grows out of the dock tile that opened it: --fx and --fy are the way from the card's middle back to that tile.
    useLayoutEffect(() => {
        const c = card.current;
        const o = dockOrigin();
        if (!c || !o) return;
        c.style.setProperty("--fx", `${o.x - Math.round(window.innerWidth / 2)}px`);
        c.style.setProperty("--fy", `${o.y - Math.round(window.innerHeight / 2)}px`);
    }, []);
    // Clicking blank space (the backdrop) closes it, like every menu on the site.
    return (
        <div className="sw-over" role="dialog" aria-modal="true" aria-label={title} data-leaving={leaving ? "" : undefined} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div ref={card} className="sw-card sw-panel" data-wide={wide ? "" : undefined} data-kind={kind}>
                <div className="sw-card-head">
                    <h2>{title}</h2>
                    {sub && <span>{sub}</span>}
                    <button type="button" className="sw-x" onClick={onClose} aria-label="Close" data-tip="Close|Esc or click empty space"><Gl n="cross" s={1} /></button>
                </div>
                <i className="sw-rule" aria-hidden="true" />
                {children}
                <Corners />
            </div>
        </div>
    );
}

// ---- Almanac ---------------------------------------------------------------------------------------------------------------

export function Almanac({ s, onClose, leaving }: { s: State; onClose: () => void; leaving?: boolean }) {
    const [sel, setSel] = useState<number | null>(null);
    const made = (i: number) => s.found.includes(ELEMENTS[i].sym);
    const codex = ELEMENTS.map((e, i) => {
        const own = s.found.includes(e.sym);
        return (
            <li key={e.sym} style={{ "--c": e.color } as CSSProperties} data-own={own ? "" : undefined} data-sel={sel === i ? "" : undefined} data-tip={own ? `${e.name}|${CODEX[e.sym]}` : "Not yet made|Fuse your way up the ladder."}>
                <button type="button" className="sw-cx" onClick={() => setSel(sel === i ? null : i)} aria-label={own ? e.name : "Not yet made"}>
                    <ElTile i={i} locked={!own} anim={own} />
                    <b data-sym={own ? e.sym : "?"}>{own ? e.name : "?"}</b>
                </button>
            </li>
        );
    });
    const medals = ACHIEVEMENTS.map((a) => {
        const own = s.ach.includes(a.id);
        return (
            <li key={a.id} data-own={own ? "" : undefined} data-tip={`${a.name}|${a.desc}`}>
                <span className="sw-medal" style={{ backgroundImage: `url("${ui(`medal-${a.id}-${own ? "own" : "lock"}`)}")` }} />
                <b>{a.name}</b>
                <span>{a.desc}</span>
            </li>
        );
    });
    return (
        <Overlay title="Almanac" sub={`${s.ach.length} of ${ACHIEVEMENTS.length} · everything +${Math.round(ACH_BONUS * 100 * s.ach.length)}%`} onClose={onClose} wide kind="wipe" leaving={leaving}>
            <Paged
                label="Almanac"
                deps={`${s.found.length}.${s.ach.length}`}
                groups={[
                    { key: "elements", title: "Elements made", className: "sw-codex", tag: "ul", units: codex },
                    { key: "milestones", title: <>Milestones <small>+{Math.round(ACH_BONUS * 100)}% to everything each</small></>, className: "sw-ach", tag: "ul", units: medals },
                ]}
                overlay={sel !== null && (
                    <div className="sw-fact" key={sel} style={{ "--c": ELEMENTS[sel].color } as CSSProperties} role="status">
                        <ElTile i={sel} locked={!made(sel)} anim={made(sel)} size={3} />
                        <div>
                            <b>{made(sel) ? ELEMENTS[sel].name : "Not yet made"} <span>{ELEMENTS[sel].sym} · weight {ELEMENTS[sel].w}</span></b>
                            <p>{made(sel) ? CODEX[ELEMENTS[sel].sym] : "Fuse your way up the ladder to find out."}</p>
                        </div>
                        <button type="button" className="sw-fact-x" onClick={() => setSel(null)} aria-label="Close this note"><Gl n="cross" s={1} /></button>
                    </div>
                )}
            />
        </Overlay>
    );
}

// ---- Orbit ----------------------------------------------------------------------------------------------------------------

function PlanetSprite({ id, stage, dim }: { id: string; stage: number; dim?: boolean }) {
    const ref = useRef<HTMLCanvasElement | null>(null);
    const probe = useProbe();
    useEffect(() => {
        const ctx = ref.current?.getContext("2d");
        if (!ctx || probe) return;
        const img = ctx.createImageData(56, 56);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const t0 = performance.now();
        let raf = 0;
        let last = 0;
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < 90) return;
            last = now;
            const t = reduce ? 3 : (now - t0) / 1000;
            // the drawn sheet when it has loaded (cropped to the planet so it fills the tile), else the code drawing
            const sh = sprites.get(`planet/${id}-s${stage}`);
            if (sh) {
                const near = sh.body <= 16;
                const crop = near ? sh.w / 2 + 4 : sh.w;
                const k = near ? 2 : 1;
                ctx.imageSmoothingEnabled = false;
                ctx.clearRect(0, 0, 56, 56);
                ctx.drawImage(sh.img, frameAt(sh, t) * sh.w + (sh.w - crop) / 2, (sh.h - crop) / 2, crop, crop, (56 - crop * k) / 2, (56 - crop * k) / 2, crop * k, crop * k);
            } else {
                renderPlanetSprite(img, id, stage, t);
                ctx.putImageData(img, 0, 0);
            }
            if (reduce && sh) cancelAnimationFrame(raf);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [id, stage, probe]);
    return <canvas ref={ref} width={56} height={56} className="sw-sprite" data-dim={dim ? "" : undefined} aria-hidden="true" />;
}

export function Orbit({ s, onBuy, onClose, leaving }: { s: State; onBuy: (id: string) => void; onClose: () => void; leaving?: boolean }) {
    const f = effects(s);
    return (
        <Overlay title="Orbit" sub={`${s.planets.length} of ${PLANETS.length} formed${f.keepPlanets ? " · they keep their age through a supernova" : " · a supernova sets them back to young"}`} onClose={onClose} wide kind="shutter" leaving={leaving}>
            <Paged label="Orbit" deps={`${s.planets.length}`} groups={[{ key: "planets", className: "sw-planets", tag: "ul", units: PLANETS.map((p) => {
                    const own = s.planets.includes(p.id);
                    const ok = canPlanet(s, p.id);
                    const st = own ? planetStage(s, p.id) : 0;
                    const age = s.planetAge[p.id] ?? 0;
                    const next = PLANET_STAGE_AT[Math.min(3, st + 1)];
                    return (
                        <li key={p.id} style={{ "--c": p.color } as CSSProperties} data-own={own ? "" : undefined} data-ok={ok ? "" : undefined}>
                            <div className="sw-pl-art" data-tip={`${p.name}|${p.kind}`}>
                                <span className="sw-orb"><PlanetSprite id={p.id} stage={own ? st : 3} dim={!own} /></span>
                                {own && <span className="sw-pips" aria-label={`stage ${st + 1} of 4`}>{[0, 1, 2, 3].map((n) => <i key={n} data-on={n <= st ? "" : undefined} />)}</span>}
                            </div>
                            <div className="sw-pl-body">
                                <b>{p.name} <small>{p.kind}</small></b>
                                <p className="sw-pl-bonus">{p.bonus}{f.planet ? <em> +{Math.round(f.planet * 100)}% Halo</em> : null}</p>
                                {own ? (
                                    <>
                                        <p className="sw-stage-line">{p.stages[st]}{st > 0 ? ` · +${Math.round(PLANET_STAGE_BONUS * 100 * st)}%` : ""}</p>
                                        {st < 3 ? (
                                            <span className="sw-pl-bar" data-tip={`Next: ${p.stages[st + 1]}|in ${fmtAge(Math.max(0, next - age))}`}><i style={{ width: `${Math.min(100, ((age - PLANET_STAGE_AT[st]) / (next - PLANET_STAGE_AT[st])) * 100)}%` }} /></span>
                                        ) : <p className="sw-stage-line">fully grown</p>}
                                    </>
                                ) : (
                                    <p className="sw-cost">
                                        {p.cost.map(([e, q], n) => (
                                            <span key={n} style={{ "--c": ELEMENTS[e].color } as CSSProperties} data-short={s.amt[e] < q ? "" : undefined} data-tip={`${ELEMENTS[e].name}|you hold ${fmt(s.amt[e])}`}>
                                                <ElTile i={e} size={1} />{fmt(q)}
                                            </span>
                                        ))}
                                    </p>
                                )}
                            </div>
                            {!own && <button type="button" className="sw-sc-buy sw-pl-form" disabled={!ok} onClick={() => onBuy(p.id)}><span>{ok ? "Form it" : "Not enough"}</span></button>}
                        </li>
                    );
                }) }]} />
        </Overlay>
    );
}

// ---- Constellations / Pulsar map --------------------------------------------------------------------------------------------

export { StarChart } from "./star-chart";

// ---- Menu -----------------------------------------------------------------------------------------------------------------

export function Menu({ sound, onSound, s, paused, onPause, onClose, onName, onImport, onReset, onExport, leaving }: { sound: boolean; onSound: () => void; s: State; paused: boolean; onPause: () => void; onClose: () => void; onName: (n: string) => void; onImport: (s: State) => void; onReset: () => void; onExport: () => void; leaving?: boolean }) {
    const shell = useGameShell();
    const [msg, setMsg] = useState("");
    const [sure, setSure] = useState(false);
    const file = useRef<HTMLInputElement | null>(null);
    const pick = async (f: File | undefined) => {
        if (!f) return;
        const r = await readPickedFile(f);
        if (!r.ok) return setMsg(r.error);
        const res = tools.importText(r.data);
        if (!res.ok) return setMsg(res.error);
        const next = parse(res.data);
        if (!next) return setMsg("That save is damaged and cannot be loaded.");
        onImport(next);
        setMsg("Save imported.");
    };
    const v = useSettings();
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    const top = [
        <label key="name" className="sw-field">
            <span>Star name</span>
            <input defaultValue={s.name} maxLength={24} onChange={(e) => onName(e.target.value)} spellCheck={false} autoComplete="off" />
        </label>,
        <div key="btns" className="sw-ibtns">
            <button type="button" className="sw-ibtn" onClick={onPause} data-tip={paused ? "Resume|The star burns again." : "Pause|Stops the clock until you resume."}><Pic sheet={paused ? "icon/menu-play" : "icon/menu-pause"} glyph={paused ? "play" : "pause"} s={3} /><span>{paused ? "Resume" : "Pause"}</span></button>
            {shell.supportsFullscreen && <button type="button" className="sw-ibtn" onClick={shell.toggleFullscreen} data-tip="Full screen|Hides the browser frame."><Pic sheet="icon/menu-full" glyph="full" s={3} /><span>{shell.fullscreen ? "Exit" : "Full"}</span></button>}
            <button type="button" className="sw-ibtn" onClick={onSound} aria-pressed={sound} data-tip={sound ? "Sound on|Click to mute." : "Sound off|Click to turn it on."}><Pic sheet={sound ? "icon/menu-sound" : "icon/menu-mute"} glyph={sound ? "sound" : "mute"} s={3} /><span>{sound ? "On" : "Off"}</span></button>
            <button type="button" className="sw-ibtn" onClick={onExport} data-tip="Export save|Downloads a file you can keep."><Pic sheet="icon/menu-export" glyph="export" s={3} /><span>Export</span></button>
            <button type="button" className="sw-ibtn" onClick={() => file.current?.click()} data-tip="Import save|Replaces this game with a file."><Pic sheet="icon/menu-import" glyph="import" s={3} /><span>Import</span></button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>,
        ...(msg ? [<p key="msg" className="sw-msg" role="status">{msg}</p>] : []),
    ];
    const foot = [
        <p key="note" className="sw-dim sw-small">Saves in this browser. Away time counts up to {TUNE.offlineH} hours. Played for {fmtAge(s.totalAge)}.</p>,
        <button key="reset" type="button" className="sw-reset" onClick={() => (sure ? onReset() : setSure(true))}>{sure ? "This erases the save. Press again." : "Reset the game"}</button>,
    ];
    return (
        <Overlay title="Menu" onClose={onClose} kind="settle" leaving={leaving}>
            <Paged
                label="Menu"
                deps={`${msg}.${sure}.${v.autoNova}.${v.autoVisitor}`}
                groups={[
                    { key: "top", className: "sw-menu", units: top },
                    { key: "settings", title: "Settings", className: "sw-setlist", tag: "ul", units: settingUnits(s, v) },
                    ...(coarse ? [] : [{ key: "keys", title: "Keys", className: "sw-keys", tag: "dl" as const, units: SW_KEYS.map(([k, d]) => <div key={k} className="sw-keyrow"><dt>{k}</dt><dd>{d}</dd></div>) }]),
                    { key: "foot", className: "sw-menu", units: foot },
                ]}
            />
        </Overlay>
    );
}

// ---- visitor card ----------------------------------------------------------------------------------------------------------

/** The icon that says what an answer pays: output now, a burst of fusion, heat, inflow or everything. */
const optGlyph = (o: EventOpt): string => {
    if (o.lump) return "dust";
    if (o.gas) return "mass";
    const k = o.buffs?.[0]?.k;
    return k === "fuse" ? "burst" : k === "heat" ? "heat" : k === "global" ? "star" : "mass";
};

export function Visitor({ s, onAnswer }: { s: State; onAnswer: (pick: number) => void }) {
    const ev = eventOf(s);
    if (!ev || !s.event) return null;
    const sheet = sheetInfo(`visitor/${ev.id}`);
    const left = Math.ceil(s.event.left);
    return (
        <div className="sw-visitor sw-ev sw-panel" role="group" aria-label={ev.name} data-kind="visitor" data-late={left <= 20 ? "" : undefined}>
            <div className="sw-ev-head">
                <span className="sw-ev-art" aria-hidden="true" style={sheet ? ({ "--sheet": cssUrl(sheet.src), "--n": sheet.frames, "--ms": `${Math.round((sheet.frames / sheet.fps) * 1000)}ms` } as CSSProperties) : undefined}>
                    {!sheet && <Gl n="star" s={3} />}
                </span>
                <div><b>{ev.name}</b><em>{ev.text}</em></div>
                <span className="sw-ev-time" aria-label={`${left} seconds left`}>{left}s</span>
            </div>
            <div className="sw-visitor-opts">
                {ev.opts.map((o, i) => (
                    <button key={o.id} type="button" className="sw-opt" onClick={() => onAnswer(i)} data-tip={`${o.label}|${o.desc}|Key ${i === 0 ? "Q" : "W"}`}>
                        <span className="sw-opt-ic" aria-hidden="true"><Gl n={optGlyph(o)} s={2} /></span>
                        <b>{o.label}</b>
                        <span className="sw-opt-d">{o.desc}</span>
                        <kbd aria-hidden="true">{i === 0 ? "Q" : "W"}</kbd>
                    </button>
                ))}
            </div>
            <i className="sw-visitor-bar" style={{ width: `${Math.max(0, (s.event.left / EVENT_STAY) * 100)}%` }} />
        </div>
    );
}

// ---- birth clouds ----------------------------------------------------------------------------------------------------------

const CLOUD_COLOR: Record<string, string> = { dense: "#5fb4ff", hot: "#ff7a4d", rich: "#ffd75e", thin: "#c9e6ff", dusty: "#c8a0ff", quiet: "#3fe0a0" };
function CloudArt({ id }: { id: string }) {
    const sheet = sheetUrl(`card/cloud-${id}`);
    return <span className="sw-cloud-art" aria-hidden="true" data-anim={sheet ? "" : undefined} style={sheet ? ({ "--sheet": cssUrl(sheet) } as CSSProperties) : { backgroundImage: cssUrl(cloudArt(id, CLOUD_COLOR[id] ?? "#ffb24d")) }} />;
}
export function CloudPick({ s, onPick, onPreview }: { s: State; onPick: (id: string) => void; onPreview?: (id: string) => void }) {
    return (
        <div className="sw-clouds sw-ev sw-panel" role="group" aria-label="Birth cloud" data-kind="clouds" onPointerLeave={() => onPreview?.("")}>
            <div className="sw-ev-head">
                <span className="sw-ev-art" aria-hidden="true"><Gl n="star" s={3} /></span>
                <div><b>A new star</b><em>Pick its birth cloud. Point at one to see the sky it makes.</em></div>
            </div>
            <div className="sw-cloud-list">
                {s.offer.map((id) => {
                    const c = CLOUDS.find((x) => x.id === id)!;
                    return (
                        <button key={id} type="button" className="sw-cloud" style={{ "--c": CLOUD_COLOR[id] ?? "#ffb24d" } as CSSProperties} onClick={() => onPick(id)}
                            onPointerEnter={() => onPreview?.(id)} onFocus={() => onPreview?.(id)} onBlur={() => onPreview?.("")}>
                            <CloudArt id={id} />
                            <b>{c.name}</b>
                            <span>{c.desc}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ---- ending ---------------------------------------------------------------------------------------------------------------

export function Ending({ count, onClose }: { count: number; onClose: () => void }) {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
        const ctx = ref.current?.getContext("2d");
        if (!ctx) return;
        const img = ctx.createImageData(W, H);
        const layers = makeLayers(ctx);
        initSprites();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const t0 = performance.now();
        let raf = 0;
        let last = 0;
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            if (now - last < 40) return;
            last = now;
            const t = (now - t0) / 1000;
            const fr: SceneFrame = { t, mass: 1, stage: 0, planets: [], ring: 0, nova: -1, hole: reduce ? 1 : Math.min(1, t / 4), pulsars: 0, reduce, sky: 2 };
            if (layers) renderLayered(layers, fr, sprites);
            else { render(img, fr); ctx.putImageData(img, 0, 0); }
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);
    return (
        <div className="sw-end" role="dialog" aria-modal="true" aria-label="The star falls in">
            <canvas ref={ref} width={W} height={H} className="sw-canvas" aria-hidden="true" />
            <div className="sw-end-copy sw-panel">
                <h2>It falls in.</h2>
                <p>Everything the star made, gold and uranium and all the iron before them, folds into one point. Nothing leaves. Somewhere far off, a cloud of hydrogen starts to turn.</p>
                <p className="sw-dim">{count} {count === 1 ? "singularity" : "singularities"}. Each doubles everything in every star that follows.</p>
                <button type="button" className="sw-go" onClick={onClose}>Light another star</button>
                <Corners />
            </div>
        </div>
    );
}
