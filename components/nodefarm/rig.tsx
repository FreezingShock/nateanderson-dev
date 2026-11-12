"use client";

// Zone rig panel: the one machine each zone has (rules in lib/nodefarm/rigs.ts). Drawn inside every zone body, under the
// effect lines. Sharp frame with corner brackets, a meter, plain data lines, set-once switches and the level buttons.
// Styles: app/camino/nodefarm-rig.css (`nf-rig*`).
import { useState, type CSSProperties } from "react";
import { sfx } from "@/lib/sound/sounds";
import { STATS, fmt, fmtTime, statDef, type Derived, type State, type StatId } from "@/lib/nodefarm/engine";
import {
    GROW_NAMES, PRISM_AIMS, RIGS, RIG_TUNE as T, buyRig, cacheCap, capCharge, capPay, capSecs, castMax, drawPay, glowFor, glowMul, growMul, growNext, growStage,
    indexMul, indexed, mirrorMul, mirrored, pourSecs, prismMul, pulseSecs, rewrite, rewritePrice, rig, rigCap, rigDef, rigLv, rigPrice, scrubBurn, setRig,
    siliconYield, stagesLit, ARC_LINKS, LINK_TUNE, arcLevel, arcOfZone, linkTier, stagingMul, stillFrac, stillMul, weather, wellMul, zoneNo,
    runningZones, spreadMul, knotsTied, knotMul, daylight, seedMax, seedMul, seedsFor, basaltYield, coolBurn, ventSecs, heatSecs, ringMul, convLevels, convMul, DESCENT_RIGS,
} from "@/lib/nodefarm/rigs";
import "@/app/camino/nodefarm-rig.css";

type Line = [string, string];
/** Row order of public/naos/nodefarm/rigs.webp (scripts/naos-art/nodefarm-rigs.py RIG_ORDER). */
const ART_ROWS: StatId[] = ["bytes", "mult", "reboot", "copper", "silicon", "quartz", "aether", "runes", "starglass", "voidsteel", "chrono", "nebula", "pulsars", "singularity", "engrams", "paradox", "origin",
    "spores", "mycelium", "pollen", "bloom", "basalt", "magma", "geodes", "core"];
/** Which of the four drawn states to show: empty, started, past half, full. Weather shows its sky instead of its clock. */
function artState(id: StatId, s: State, frac: number): number {
    if (id === "pollen") return s.prod.pollen > 0 && daylight(s).phase === "day" ? 3 : 0;
    if (id === "magma") return (rig(s).heat ?? 0) > 0 ? 3 : frac >= 0.5 ? 2 : frac > 0.02 ? 1 : 0;
    if (id === "nebula") { const w = weather(s); return s.prod.nebula > 0 ? (w.phase === "storm" ? 3 : w.phase === "front" ? 2 : 0) : 0; }
    return frac >= 0.999 ? 3 : frac >= 0.5 ? 2 : frac > 0.02 ? 1 : 0;
}
interface View { frac: number; meter: string; lines: Line[]; warn?: boolean }
const x = (v: number) => `×${fmt(v)}`;
const name = (id: string) => statDef(id as StatId).name;

/** What the rig shows right now: a meter (0..1 with its label) and a few live lines. */
function view(id: StatId, s: State, d: Derived): View {
    const r = rig(s);
    switch (id) {
        case "bytes": {
            const cap = cacheCap(s, d.bytesPerSec);
            return { frac: cap > 0 ? r.cache / cap : 0, meter: `cache ${fmt(r.cache)} / ${fmt(cap)} B`, lines: [["Next Reboot pays back", `+${fmt(r.cache)} B`]] };
        }
        case "mult": {
            const n = stagesLit(s);
            return { frac: n / 6, meter: `${n}/6 stages lit${n >= 6 ? " · full stack" : ""}`, lines: [["Multiplier buttons", x(stagingMul(s))], ["Lights next", n >= 6 ? "all lit" : `own any ${["Relay", "Booster", "Amp", "Rack", "Array", "Grid"][s.bought.mult.findIndex((v) => v === 0)]}`]] };
        }
        case "reboot": {
            const c = capCharge(s);
            return { frac: c, meter: c >= 1 ? "charged" : `charging · full in ${fmtTime(capSecs(s) * (1 - c))}`, lines: [["Next Reboot pays", `+${fmt(c * capPay(s) * 100)}% Reboots`]] };
        }
        case "copper": {
            const per = pourSecs(s);
            return { frac: s.prod.copper > 0 ? r.pour / per : 0, meter: s.prod.copper > 0 ? `pour in ${fmtTime(per - r.pour)}` : "idle until Copper runs", lines: [["Casts", `${fmt(r.casts)} / ${fmt(castMax(s))}`], ["Copper output", x(1 + r.casts * T.castEach)], ["Each pour", `${T.pourPays} s of Copper`]] };
        }
        case "silicon": {
            const y = siliconYield(s);
            return { frac: r.dust, warn: y < 1, meter: `dust ${Math.round(r.dust * 100)}%${r.scrub ? " · clearing" : " · settling"}`, lines: [["Silicon yield", `${Math.round(y * 100)}%`], ["Scrubbers burn", r.scrub ? `${Math.round(scrubBurn(s) * 100)}% of Copper` : "nothing (off)"]] };
        }
        case "quartz": {
            const st = growStage(s);
            const left = growNext(s);
            return { frac: st / T.growMins.length, meter: `${GROW_NAMES[st]}${left > 0 ? ` · ${GROW_NAMES[st + 1]} in ${fmtTime(left)}` : " · fully grown"}`, lines: [["Quartz output", x(growMul(s))]] };
        }
        case "aether": {
            const g = glowFor(s);
            return { frac: r.glowLeft > 0 ? r.glowLeft / Math.max(1, (T.glowMins + T.glowMinsLv * rigLv(s, "aether")) * 60) : 0, meter: r.glowLeft > 0 ? `afterglow ×${fmt(glowMul(s))} · ${fmtTime(r.glowLeft)} left` : "no afterglow running", lines: [["Ascend now leaves", g > 0 ? `×${fmt(1 + g)} on Copper to Quartz` : "nothing (no spare Aether)"]] };
        }
        case "runes":
            return { frac: (rigLv(s, "runes:echo") + rigLv(s, "runes:ward") + rigLv(s, "runes:root")) / (3 * rigCap(s, "runes")), meter: "carved glyphs", lines: [["Aether (Echo)", x(1 + T.glyph * rigLv(s, "runes:echo"))], ["Runes (Ward)", x(1 + T.glyph * rigLv(s, "runes:ward"))], ["Quartz (Root)", x(1 + T.glyph * rigLv(s, "runes:root"))]] };
        case "starglass": {
            const m = prismMul(s);
            return { frac: (m - 1) / (T.prismMax - 1), meter: `beam on ${name(r.aim)}`, lines: [[`${name(r.aim)} output`, x(m)]] };
        }
        case "voidsteel":
            return { frac: r.draw / 0.25, meter: r.draw ? `drawing ${Math.round(r.draw * 100)}% of Starglass` : "draw closed", lines: [["Voidsteel output", x(drawPay(s))], ["Starglass output", r.draw ? `×${fmt(1 - r.draw)}` : "untouched"]] };
        case "chrono": {
            const f = stillFrac(s);
            return { frac: f, meter: f >= 1 ? "perfectly still" : `still for ${fmtTime(r.quiet)}`, lines: [["Chrono output", x(stillMul(s))], ["Breaks it", "a button press of yours"]] };
        }
        case "nebula": {
            const w = weather(s);
            return { frac: r.wx / (T.wxMins * 60), warn: w.phase === "front", meter: s.prod.nebula > 0 ? `${w.phase} · ${fmtTime(w.left)} left` : "calm until Nebula runs", lines: [["Nebula output", x(w.mul)]] };
        }
        case "pulsars":
            return { frac: r.pulses / T.pulsesPer, meter: s.prod.pulsars > 0 ? `${r.pulses}/${T.pulsesPer} pulses · one every ${fmt(pulseSecs(s), 1)} s` : "dark until Pulsars run", lines: [["Free Overclocks this run", fmt(r.fired)]] };
        case "singularity": {
            const m = wellMul(s);
            return { frac: Math.min(1, Math.log10(1 + r.well) / 8), meter: `mass ${fmt(r.well)}`, lines: [["Singularity output", x(m)]] };
        }
        case "engrams":
            return { frac: Math.min(1, indexed(s) / 80), meter: `${indexed(s)} records filed`, lines: [["Engram output", x(indexMul(s))]] };
        case "paradox": {
            const z = mirrored(s);
            return { frac: (mirrorMul(s) - 1) / (T.mirrorMax - 1), meter: z ? `mirroring ${name(z)}` : "nothing to mirror", lines: [[z ? `${name(z)} output` : "Reflection", x(mirrorMul(s))]] };
        }
        case "origin": {
            const total = Object.values(r.re).reduce((a, b) => a + b, 0);
            return { frac: total / (T.rewriteMax * (RIGS.length - 1)), meter: `${total} rewrites`, lines: [["Next rewrite target", `${zoneNo(r.rwAim as StatId)} ${rigDef(r.rwAim as StatId)?.name} · cap ${rigCap(s, r.rwAim as StatId)}`]] };
        }
        case "spores": {
            const n = runningZones(s);
            return { frac: n / 22, meter: `${n} zones running`, lines: [["Spores output", x(spreadMul(s))]] };
        }
        case "mycelium": {
            const n = knotsTied(s);
            return { frac: n / 12, meter: `${n}/12 knots tied${n >= 12 ? " · whole web" : ""}`, lines: [["Mycelium output", x(knotMul(s))], ["Ties a knot", "any Spores or Mycelium tier you don't own yet"]] };
        }
        case "pollen": {
            const dl = daylight(s);
            return { frac: (r.sun ?? 0) / (T.sunMins * 60), meter: s.prod.pollen > 0 ? `${dl.phase} · ${fmtTime(dl.left)} left` : "dark until Pollen runs", lines: [["Pollen output", x(dl.mul)], ["Spores and Mycelium", dl.below > 1 ? x(dl.below) : "untouched by day"]] };
        }
        case "bloom": {
            const n = r.seeds ?? 0;
            return { frac: n / seedMax(s), meter: `${fmt(n)} / ${fmt(seedMax(s))} seeds banked`, lines: [["Bloom output", x(seedMul(s))], ["Ascend now banks", `+${Math.max(0, Math.min(seedMax(s) - n, seedsFor(s)))} seeds`]] };
        }
        case "basalt": {
            const y = basaltYield(s);
            const w = r.wear ?? 0;
            return { frac: w, warn: y < 1, meter: `bit wear ${Math.round(w * 100)}%${r.cool ? " · cooling" : " · wearing"}`, lines: [["Basalt yield", `${Math.round(y * 100)}%`], ["Coolant burns", r.cool ? `${Math.round(coolBurn(s) * 100)}% of Bloom` : "nothing (off)"]] };
        }
        case "magma": {
            const per = ventSecs(s);
            const h = r.heat ?? 0;
            return { frac: s.prod.magma > 0 ? (r.vent ?? 0) / per : 0, meter: s.prod.magma > 0 ? `eruption in ${fmtTime(per - (r.vent ?? 0))}` : "quiet until Magma runs", lines: [["Each eruption", `${T.ventPays} s of Magma`], ["Shaft heat", h > 0 ? `Basalt ×${fmt(T.heat)} · ${fmtTime(h)} left` : `none (lasts ${fmtTime(heatSecs(s))})`]] };
        }
        case "geodes": {
            const m = ringMul(s);
            return { frac: (m - 1) / (T.ringMax - 1), meter: `ringing with ${fmt(s.quartz)} Quartz`, lines: [["Geodes output", x(m)]] };
        }
        case "core": {
            const n = convLevels(s);
            return { frac: n / (DESCENT_RIGS.length * (T.baseCap + T.rewriteMax)), meter: `${n} rig levels below`, lines: [["Core output", x(convMul(s))]] };
        }
        default:
            return { frac: 0, meter: "", lines: [] };
    }
}

export function ZoneRig({ id, s, d }: { id: StatId; s: State; d: Derived }) {
    const [, bump] = useState(0);
    const def = rigDef(id);
    if (!def) return null;
    const r = rig(s);
    const v = view(id, s, d);
    const act = (fn: () => boolean | void) => { const res = fn(); sfx(res === false ? "deny" : "tab"); bump((n) => n + 1); };
    const cap = rigCap(s, id);
    const lvs = def.keys.map((k) => rigLv(s, k.key));
    return (
        <section className="nf-rig" data-kind={def.kind} data-warn={v.warn ? "" : undefined} aria-label={`Zone rig: ${def.name}`}>
            {ART_ROWS.includes(id) && <i className="nf-rig-art" aria-hidden="true" style={{ ["--row" as string]: ART_ROWS.indexOf(id), ["--st" as string]: artState(id, s, v.frac) } as CSSProperties} />}
            <header className="nf-rig-h">
                <span className="nf-rig-k">RIG // {def.name}</span>
                {def.keys.length > 0 && <span className="nf-rig-lv">lv {lvs.join(" · ")} / {cap}</span>}
            </header>
            <p className="nf-rig-rule">{def.rule}</p>
            <div className="nf-rig-m">
                <span className="nf-rig-bar" role="meter" aria-label={v.meter} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(1, v.frac)) * 100)}>
                    <i style={{ width: `${Math.max(0, Math.min(1, v.frac)) * 100}%` }} />
                </span>
                <small>{v.meter}</small>
            </div>
            <dl className="nf-spec nf-rig-spec">
                {v.lines.map(([k, val]) => <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{val}</dd></div>)}
            </dl>
            {id === "silicon" && (
                <div className="nf-rig-ctl">
                    <span>Scrubbers</span>
                    <button type="button" className="nf-mini" aria-pressed={r.scrub} onClick={() => act(() => setRig(s, "scrub", !r.scrub))}>{r.scrub ? "On" : "Off"}</button>
                </div>
            )}
            {id === "basalt" && (
                <div className="nf-rig-ctl">
                    <span>Coolant</span>
                    <button type="button" className="nf-mini" aria-pressed={!!r.cool} onClick={() => act(() => setRig(s, "cool", !r.cool))}>{r.cool ? "On" : "Off"}</button>
                </div>
            )}
            {id === "starglass" && (
                <div className="nf-rig-ctl">
                    <span>Aim</span>
                    <span className="nf-rig-opts">
                        {PRISM_AIMS.map((z) => <button key={z} type="button" className="nf-mini" aria-pressed={r.aim === z} onClick={() => act(() => setRig(s, "aim", z))}>{statDef(z).short}</button>)}
                    </span>
                </div>
            )}
            {id === "voidsteel" && (
                <div className="nf-rig-ctl">
                    <span>Draw</span>
                    <span className="nf-rig-opts">
                        {T.draws.map((v2) => <button key={v2} type="button" className="nf-mini" aria-pressed={r.draw === v2} onClick={() => act(() => setRig(s, "draw", v2))}>{Math.round(v2 * 100)}%</button>)}
                    </span>
                </div>
            )}
            {id === "origin" && <Rewrite s={s} d={d} act={act} />}
            {def.keys.length > 0 && (
                <div className="nf-rig-ups">
                    {def.keys.map((k) => {
                        const p = rigPrice(s, k.key, d);
                        const lv = rigLv(s, k.key);
                        const ok = !p.maxed && Number.isFinite(p.cost) && (s[p.pays] as number) >= p.cost;
                        return (
                            <button key={k.key} type="button" className="nf-rig-up" data-afford={ok ? "" : undefined} disabled={p.maxed} onClick={() => act(() => buyRig(s, k.key))}
                                aria-label={p.maxed ? `${k.name} at max level ${lv}` : `Upgrade ${k.name} to level ${lv + 1}: ${k.perLv}, costs ${fmt(p.cost)} ${statDef(p.pays).name}`}>
                                <span className="nf-rig-up-t">{def.keys.length > 1 ? k.name : "Upgrade"} {p.maxed ? `lv ${lv} · max` : `→ lv ${lv + 1}`}</span>
                                <span className="nf-rig-up-d">{p.maxed ? (cap < T.baseCap + T.rewriteMax ? "Root chamber can raise this cap" : "fully rewritten") : k.perLv}</span>
                                {!p.maxed && <span className="nf-rig-up-c">{Number.isFinite(p.cost) ? `${fmt(p.cost)} ${statDef(p.pays).short}` : `needs ${statDef(p.pays).name} running`}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
            <ArcLinkLine id={id} s={s} />
        </section>
    );
}

function Rewrite({ s, d, act }: { s: State; d: Derived; act: (fn: () => boolean | void) => void }) {
    const r = rig(s);
    const c = rewritePrice(s, d);
    const target = r.rwAim as StatId;
    const full = (r.re[target] ?? 0) >= T.rewriteMax;
    const ok = !full && Number.isFinite(c) && s.origin >= c;
    return (
        <>
            <div className="nf-rig-ctl">
                <span>Rewrite</span>
                <span className="nf-rig-opts nf-rig-zones">
                    {STATS.filter((z) => z.id !== "origin").map((z) => (
                        <button key={z.id} type="button" className="nf-mini" aria-pressed={r.rwAim === z.id} title={`${rigDef(z.id)?.name}: +${r.re[z.id] ?? 0} of ${T.rewriteMax}`} onClick={() => act(() => setRig(s, "rwAim", z.id))}>
                            {zoneNo(z.id)}{(r.re[z.id] ?? 0) > 0 ? `+${r.re[z.id]}` : ""}
                        </button>
                    ))}
                </span>
            </div>
            <div className="nf-rig-ups">
                <button type="button" className="nf-rig-up" data-afford={ok ? "" : undefined} disabled={full} onClick={() => act(() => rewrite(s))}>
                    <span className="nf-rig-up-t">Rewrite {rigDef(target)?.name}</span>
                    <span className="nf-rig-up-d">{full ? "already rewritten three times" : `level cap ${rigCap(s, target)} → ${rigCap(s, target) + 1}, kept forever`}</span>
                    {!full && <span className="nf-rig-up-c">{Number.isFinite(c) ? `${fmt(c)} OR` : "needs Origin running"}</span>}
                </button>
            </div>
        </>
    );
}

const ROMAN3 = ["I", "II", "III"];
/** The arc this zone sits in: its link's name and rule, how many milestones are lit, and what lights the next. */
function ArcLinkLine({ id, s }: { id: StatId; s: State }) {
    const arc = arcOfZone(id);
    if (!arc) return null;
    const link = ARC_LINKS[arc.id];
    const tier = linkTier(s, arc.id);
    const lv = arcLevel(s, arc.id);
    const next = LINK_TUNE.at[tier];
    const bonus = tier > 0 ? `${arc.name} zones ×${LINK_TUNE.mul[tier - 1]}` : "";
    return (
        <p className="nf-rig-link" data-on={tier > 0 ? "" : undefined}>
            <b>Arc link // {link?.name ?? arc.name}</b>
            <i aria-label={`${tier} of 3 milestones lit`}>{ROMAN3.map((r, k) => (k < tier ? r : "·")).join(" ")}</i>
            <span>
                {tier > 0 ? `${link ? `On: ${link.rule}. ` : ""}${bonus}.` : link ? `Lights at lv ${LINK_TUNE.at[0]}: ${link.rule}.` : ""}
                {next ? ` Next: every rig in ${arc.name} at lv ${next} (lowest is ${lv}).` : " Fully lit."}
            </span>
        </p>
    );
}
