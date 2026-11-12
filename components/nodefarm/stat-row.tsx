"use client";

import { useContext, useEffect, useRef, type CSSProperties } from "react";
import { MATS, ROMAN, STATS, TIERS, button, postOf, zoneRank, derive, droneBoost, originAp, paradoxOc, bloomKeys, sunstoneAll, singularityAll, fmt, fmtTime, hasFeature, isUnlocked, statDef, type ButtonStat, type State, type StatId } from "@/lib/nodefarm/engine";
import { LORE } from "@/lib/nodefarm/lore";
import { fnCaption } from "@/lib/nodefarm/feed";
import { buttonTip, exact, unlockInfo, type Target } from "@/lib/nodefarm/guide";
import { TipCtx } from "./guide";
import { NfIcon, NfTierIcon, type NfIconName } from "./icon";
import { useFoldReveal } from "@/lib/nodefarm/cx";
import { hasZoneArt } from "@/lib/nodefarm/zone-art";
import { ZoneArt } from "./zone-art";
import { ZoneRig } from "./rig";
import { ZoneEvent } from "./zone-event";
import { eventsFor, zoneEvDef, type ZeChoice } from "@/lib/nodefarm/zoneevents";
import { readyCount } from "@/lib/nodefarm/layout";

type D = ReturnType<typeof derive>;
export type PressFn = (stat: ButtonStat, tier: number, quiet?: boolean) => boolean;

/** What this stat is doing for you right now, as label and value pairs for the spec lines. */
function effects(id: StatId, s: State, d: D): [string, string][] {
    switch (id) {
        case "bytes":
            return [["Output", `+${fmt(d.bytesPerSec)}/s`], ["Global boost", `×${fmt(d.global)}`]];
        case "mult":
            return [["Each unit adds", "+1 B/s"], ["Button strength", `×${fmt(d.multGainMult)}`]];
        case "reboot":
            return [["Per Reboot", `+${fmt(d.rebootStrength * 100)}% to buttons`], ["On press", "wipes Bytes + MUL"]];
        case "copper":
            return [["Feeds Reboot power", `×${fmt(d.boosts.cuReboot)}`], ["Feeds Bytes", `×${fmt(d.boosts.cuBytes)}`]];
        case "silicon":
            return [["Feeds Copper", `×${fmt(d.boosts.siCu)}`], ["Own output", `${fmt(d.rates.silicon)}/s`]];
        case "quartz":
            return [["Feeds Silicon", `×${fmt(d.boosts.qzSi)}`], ["Own output", `${fmt(d.rates.quartz)}/s`]];
        case "aether":
            return [["Feeds Quartz", `×${fmt(d.boosts.aeQz)}`], ["Opens", "Ascend"]];
        case "runes":
            return [["Feeds Aether", `×${fmt(d.boosts.ruAe)}`], ["Own output", `${fmt(d.rates.runes)}/s`]];
        case "starglass":
            return [["Feeds Runes", `×${fmt(d.boosts.sgRu)}`], ["Own output", `${fmt(d.rates.starglass)}/s`]];
        case "voidsteel":
            return [["Feeds Starglass", `×${fmt(d.boosts.vsSg)}`], ["Own output", `${fmt(d.rates.voidsteel)}/s`]];
        case "chrono":
            return [["Feeds Voidsteel", `×${fmt(d.boosts.chVs)}`], ["Everything", `×${fmt(d.boosts.chAll)}`]];
        case "nebula":
            return [["Feeds Chrono", `×${fmt(d.boosts.nbCh)}`], ["Own output", `${fmt(d.rates.nebula)}/s`]];
        case "pulsars":
            return [["Feeds Nebula", `×${fmt(d.boosts.puNb)}`], ["Own output", `${fmt(d.rates.pulsars)}/s`]];
        case "singularity":
            return [["Feeds Pulsars", `×${fmt(d.boosts.snPu)}`], ["Everything", `×${fmt(singularityAll(s))}`]];
        case "engrams":
            return [["Feeds Singularity", `×${fmt(d.boosts.egSn)}`], ["Drone speed", `×${fmt(droneBoost(s))}`]];
        case "paradox":
            return [["Feeds Engrams", `×${fmt(d.boosts.pxEg)}`], ["Overclock", `×${fmt(paradoxOc(s))}`]];
        case "origin":
            return [["Feeds Paradox", `×${fmt(d.boosts.orPx)}`], ["AP on Ascend", `×${fmt(originAp(s))}`]];
        case "spores":
            return [["Feeds Origin", `×${fmt(d.boosts.spOr)}`], ["Own output", `${fmt(d.rates.spores)}/s`]];
        case "mycelium":
            return [["Feeds Spores", `×${fmt(d.boosts.mySp)}`], ["Own output", `${fmt(d.rates.mycelium)}/s`]];
        case "pollen":
            return [["Feeds Mycelium", `×${fmt(d.boosts.poMy)}`], ["Own output", `${fmt(d.rates.pollen)}/s`]];
        case "bloom":
            return [["Feeds Pollen", `×${fmt(d.boosts.blPo)}`], ["Keys on Handover", `×${fmt(bloomKeys(s))}`]];
        case "basalt":
            return [["Feeds Bloom", `×${fmt(d.boosts.baBl)}`], ["Own output", `${fmt(d.rates.basalt)}/s`]];
        case "magma":
            return [["Feeds Basalt", `×${fmt(d.boosts.mgBa)}`], ["Own output", `${fmt(d.rates.magma)}/s`]];
        case "geodes":
            return [["Feeds Magma", `×${fmt(d.boosts.geMg)}`], ["Own output", `${fmt(d.rates.geodes)}/s`]];
        case "sunstone":
            return [["Feeds Geodes", `×${fmt(d.boosts.suGe)}`], ["Everything", `×${fmt(sunstoneAll(s))}`]];
    }
}

/** The signal chain: who boosts whom, with live multipliers. Sits above the stat dossiers. Only the zones you have reached, plus the next one, are drawn. */
export function Chain({ s, d, onAll, allOpen, onIdle, onJump }: { s: State; d: D; onAll: (open: boolean) => void; allOpen: boolean; onIdle?: () => void; onJump?: (id: StatId) => void }) {
    const feed: Partial<Record<StatId, string>> = {
        sunstone: `Geodes ×${fmt(d.boosts.suGe)}`,
        geodes: `Magma ×${fmt(d.boosts.geMg)}`,
        magma: `Basalt ×${fmt(d.boosts.mgBa)}`,
        basalt: `Bloom ×${fmt(d.boosts.baBl)}`,
        bloom: `Pollen ×${fmt(d.boosts.blPo)}`,
        pollen: `Mycelium ×${fmt(d.boosts.poMy)}`,
        mycelium: `Spores ×${fmt(d.boosts.mySp)}`,
        spores: `Origin ×${fmt(d.boosts.spOr)}`,
        origin: `Paradox ×${fmt(d.boosts.orPx)}`,
        paradox: `Engrams ×${fmt(d.boosts.pxEg)}`,
        engrams: `Singularity ×${fmt(d.boosts.egSn)}`,
        singularity: `Pulsars ×${fmt(d.boosts.snPu)}`,
        pulsars: `Nebula ×${fmt(d.boosts.puNb)}`,
        nebula: `Chrono ×${fmt(d.boosts.nbCh)}`,
        chrono: `Voidsteel ×${fmt(d.boosts.chVs)}`,
        voidsteel: `Starglass ×${fmt(d.boosts.vsSg)}`,
        starglass: `Runes ×${fmt(d.boosts.sgRu)}`,
        runes: `Aether ×${fmt(d.boosts.ruAe)}`,
        aether: `Quartz ×${fmt(d.boosts.aeQz)}`,
        quartz: `Silicon ×${fmt(d.boosts.qzSi)}`,
        silicon: `Copper ×${fmt(d.boosts.siCu)}`,
        copper: `Reboots ×${fmt(d.boosts.cuReboot)}`,
        reboot: `Buttons ×${fmt(d.multGainMult)}`,
        mult: `Bytes +${fmt(s.mult)}`,
        bytes: `+${fmt(d.bytesPerSec)}/s`,
    };
    const order = [...STATS].reverse();
    const firstLocked = STATS.find((x) => !isUnlocked(s, x.id));
    const hidden = firstLocked ? STATS.length - STATS.indexOf(firstLocked) - 1 : 0;
    const shown = order.slice(hidden);
    return (
        <ol className="nf-chain" aria-label="Signal chain: each stat boosts the next">
            {hidden > 0 && (
                <li className="nf-chain-more" aria-label={`${hidden} more zones still encrypted`}>
                    <NfIcon name="lock" />
                    <b>{hidden} more</b>
                    <small>zones encrypted</small>
                    <i aria-hidden="true">▸</i>
                </li>
            )}
            {shown.map((def, i) => {
                const open = isUnlocked(s, def.id);
                const rdy = open ? readyCount(s, def.id) : 0;
                const body = (
                    <>
                        <NfIcon name={open ? (def.id as NfIconName) : "lock"} />
                        <b>{def.short}</b>
                        <small>{open ? feed[def.id] : "encrypted"}</small>
                    </>
                );
                return (
                    <li key={def.id} data-open={open ? "" : undefined} data-ready={rdy ? "" : undefined} data-ev={open && eventsFor(s, def.id).length ? "" : undefined} style={{ ["--c" as string]: def.color, ["--ev" as string]: zoneEvDef(eventsFor(s, def.id)[0]?.kind ?? "surge").color }}>
                        {open && onJump ? (
                            <button type="button" className="nf-chain-b" onClick={() => onJump(def.id)} aria-label={`Go to ${def.name}${rdy ? `, ${rdy} button${rdy > 1 ? "s" : ""} ready` : ""}`}>{body}</button>
                        ) : body}
                        {i < shown.length - 1 && <i aria-hidden="true">▸</i>}
                    </li>
                );
            })}
            <li className="nf-chain-all">
                {onIdle && <button type="button" className="nf-mini" onClick={onIdle} title="Fold every zone with nothing to buy">Fold idle</button>}
                <button type="button" className="nf-mini" onClick={() => onAll(!allOpen)}>{allOpen ? "Minimize all" : "Expand all"}</button>
            </li>
        </ol>
    );
}

export function StatRow({ id, s, d, onPress, onArm, onWatchdog, open: expanded, onToggle, guide, onZoneEv, zeCard }: { id: StatId; s: State; d: D; onPress: PressFn; onArm: () => void; onWatchdog?: () => void; open: boolean; onToggle: () => void; guide?: Target; onZoneEv?: (id: number, c: ZeChoice) => void; zeCard?: number | null }) {
    const def = statDef(id);
    const lore = LORE[id];
    const bodyIn = useRef<HTMLDivElement>(null);
    useFoldReveal(bodyIn, expanded);
    const open = isUnlocked(s, id);
    if (!open) {
        const u = unlockInfo(s, id);
        const pct = Math.round(u.frac * 100);
        return (
            <article className="nf-row nf-locked" style={{ ["--c" as string]: def.color }} data-stat={id}>
                <span className="nf-plate"><NfIcon name="lock" /></span>
                <div className="nf-lk">
                    <span className="nf-lk-k">ZONE {String(STATS.findIndex((x) => x.id === id) + 1).padStart(2, "0")} // ENCRYPTED</span>
                    <b>{def.name}</b>
                    <small>Unlocks at: {u.label.charAt(0).toLowerCase() + u.label.slice(1)}.</small>
                    <code className="nf-lk-code" aria-hidden="true">
                        <span data-k="kw">if</span><span data-k="p"> (</span><span data-k="id">{u.unit.toLowerCase()}</span><span data-k="p"> &gt;= </span><span data-k="num">{fmt(u.need)}</span><span data-k="p">) </span><span data-k="id" style={{ ["--tc" as string]: def.color }}>{id}</span><span data-k="p">.</span><span data-k="fn">decrypt</span><span data-k="p">()</span>
                    </code>
                    <span className="nf-lk-m">
                        <span className="nf-bar sm" role="progressbar" aria-label={`Progress to decrypt ${def.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
                        <small>{fmt(u.cur)} / {fmt(u.need)} {u.unit}</small>
                    </span>
                </div>
            </article>
        );
    }
    const amt = s[id] as number;
    const isMat = (MATS as readonly string[]).includes(id);
    const rate = id === "bytes" ? d.bytesPerSec : isMat ? d.rates[id as (typeof MATS)[number]] : 0;
    const prod = isMat ? s.prod[id as (typeof MATS)[number]] : 0;
    const buttons = id === "bytes" ? 0 : TIERS;
    const ready = id === "bytes" ? 0 : Array.from({ length: TIERS }, (_, k) => k).filter((k) => (s[button(s, id as ButtonStat, k).pays] as number) >= button(s, id as ButtonStat, k).cost).length;
    const bodyId = `nf-body-${id}`;
    const evs = eventsFor(s, id);
    return (
        <article className="nf-row" style={{ ["--c" as string]: def.color, ...(evs.length ? { ["--ev" as string]: zoneEvDef(evs[0].kind).color } : null) }} data-ev={evs.length ? "" : undefined} data-stat={id} data-open={expanded ? "true" : "false"} data-ready={!expanded && ready > 0 ? "" : undefined} data-guide={guide?.stat === id ? "" : undefined} data-art={hasZoneArt(id) ? "" : undefined}>
            <ZoneArt id={id} s={s} />
            <div className="nf-bar-t">
                <span className="nf-bar-ic" aria-hidden="true"><NfIcon name={id as NfIconName} /></span>
                <span>ZONE {String(STATS.findIndex((x) => x.id === id) + 1).padStart(2, "0")} // {lore.zone}</span>
                {!expanded && <span className="nf-bar-v" title={exact(amt)}><b>{fmt(amt)}</b> {def.short}{rate > 0 && <small> +{fmt(rate)}/s</small>}</span>}
                <span className="nf-bar-s">{buttons > 0 ? `${ready}/${buttons} ready` : "online"}</span>
                <button type="button" className="nf-fold" aria-expanded={expanded} aria-controls={bodyId} aria-label={`${expanded ? "Minimize" : "Expand"} ${def.name}`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </div>
            <header className="nf-row-h">
                <span className="nf-plate"><NfIcon name={id as NfIconName} responsive /></span>
                <div className="nf-row-t">
                    <b>{def.name} <em>{def.short}</em></b>
                    <span className="nf-code">{lore.code}</span>
                </div>
                <div className="nf-row-n">
                    <b>{fmt(amt)}</b>
                    {rate > 0 && <small>+{fmt(rate)}/s</small>}
                    {prod > 0 && <small>{fmt(prod)} nodes</small>}
                </div>
            </header>
            {evs.map((e) => <ZoneEvent key={e.id} s={s} zone={id} e={e} onChoose={(i, c) => onZoneEv?.(i, c)} cardId={zeCard} />)}
            <div className="nf-body" id={bodyId}>
                <div className="nf-body-in" ref={bodyIn} inert={!expanded}>
                    <p className="nf-brief">{lore.flavor}</p>
                    <dl className="nf-spec" aria-label="Effects">
                        {effects(id, s, d).map(([k, v]) => (
                            <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{v}</dd></div>
                        ))}
                    </dl>
                    <ZoneRig id={id} s={s} d={d} />
                    {id !== "bytes" && id !== "reboot" && s.drones.some((x) => x > 0) && (
                        <div className="nf-arm">
                            <span>Drones</span>
                            <PostedHere s={s} id={id as ButtonStat} />
                            <button type="button" className="nf-mini" aria-pressed={s.armed.includes(id)} onClick={onArm}>{s.armed.includes(id) ? "Armed" : "Off"}</button>
                        </div>
                    )}
                    {id === "reboot" && onWatchdog && hasFeature(s, "watchdog") && (
                        <div className="nf-arm">
                            <span>Watchdog timer</span>
                            <button type="button" className="nf-mini" aria-pressed={s.watchdog} onClick={onWatchdog}>{s.watchdog ? "Auto" : "Off"}</button>
                        </div>
                    )}
                    {id !== "bytes" && (
                        <div className="nf-btns">
                            {Array.from({ length: TIERS }, (_, k) => (
                                <BuyBtn key={k} s={s} d={d} stat={id as ButtonStat} tier={k} onPress={onPress} guided={guide?.stat === id && guide.tier === k} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

// A buy button, skinned per stat in CSS. Press once to buy; hold to keep buying (after 0.4 s, then 10 a second).
function BuyBtn({ s, d, stat, tier, onPress, guided }: { s: State; d: D; stat: ButtonStat; tier: number; onPress: PressFn; guided: boolean }) {
    const tips = useContext(TipCtx);
    const b = button(s, stat, tier);
    const pays = statDef(b.pays);
    const afford = (s[b.pays] as number) >= b.cost;
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iv = useRef<ReturnType<typeof setInterval> | null>(null);
    const pending = useRef(false); // touch: a press waiting for release
    const stop = () => {
        if (t.current) clearTimeout(t.current);
        if (iv.current) clearInterval(iv.current);
        t.current = iv.current = null;
    };
    useEffect(() => stop, []);
    const build = () => buttonTip(s, stat, tier);
    const isReboot = stat === "reboot";
    const name = LORE[stat].tiers[tier];
    const owned = isReboot ? 0 : s.bought[stat][tier];
    // Forecast node: how long until this button is affordable, at the current rate of the stat that pays for it
    const payRate = b.pays === "bytes" ? d.bytesPerSec : (MATS as readonly string[]).includes(b.pays) ? d.rates[b.pays as (typeof MATS)[number]] : 0;
    const eta = !afford && payRate > 0 && (guided || hasFeature(s, "forecast")) ? (b.cost - (s[b.pays] as number)) / payRate : 0;
    return (
        <button
            type="button"
            className="nf-btn"
            data-afford={afford ? "" : undefined}
            data-tier={tier}
            data-guide={guided ? "" : undefined}
            aria-label={`${name}: ${isReboot ? "Reboot for" : "buy"} +${fmt(b.gain)} ${statDef(stat).name} for ${fmt(b.cost)} ${pays.name}${owned ? `, owned ${owned}` : ""}`}
            onPointerEnter={(e) => { if (e.pointerType === "mouse") tips.show(e.currentTarget, build, { guided }); }}
            onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) tips.show(e.currentTarget, build, { guided }); }}
            onBlur={(e) => tips.hide(e.currentTarget)}
            onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                // no hover on touch: show the tip for a moment after the tap, so a button you cannot afford yet still explains itself
                if (e.pointerType !== "mouse") tips.show(e.currentTarget, build, { ms: 2600, guided });
                stop();
                if (e.pointerType !== "mouse") {
                    // touch: a finger that lands here may be scrolling the page, so buy on release (a scroll cancels the pointer
                    // first). Held for 0.35 s it buys and then repeats like a mouse hold.
                    pending.current = true;
                    if (isReboot) return;
                    t.current = setTimeout(() => {
                        pending.current = false;
                        onPress(stat, tier);
                        iv.current = setInterval(() => {
                            if (!onPress(stat, tier, true)) stop();
                        }, 100);
                    }, 350);
                    return;
                }
                onPress(stat, tier);
                if (isReboot) return;
                t.current = setTimeout(() => {
                    iv.current = setInterval(() => {
                        if (!onPress(stat, tier, true)) stop();
                    }, 100);
                }, 400);
            }}
            onPointerUp={() => {
                stop();
                if (pending.current) { pending.current = false; onPress(stat, tier); }
            }}
            onPointerLeave={(e) => { stop(); pending.current = false; if (e.pointerType === "mouse") tips.hide(e.currentTarget); }}
            onPointerCancel={() => { stop(); pending.current = false; }}
            onClick={(e) => e.detail === 0 && onPress(stat, tier)}
            onContextMenu={(e) => e.preventDefault()}
        >
            <span className="nf-btn-top">
                <span className="nf-btn-name">{name}</span>
                <span className="nf-pips" aria-hidden="true">
                    {Array.from({ length: tier + 1 }, (_, i) => <i key={i} />)}
                </span>
            </span>
            {guided && <i className="nf-gd-c" aria-hidden="true" />}
            <i className="nf-rar" aria-hidden="true" />
            <NfTierIcon stat={stat} tier={tier} />
            <span className="nf-btn-g">+{fmt(b.gain)}</span>
            <span className="nf-btn-fn" aria-hidden="true">{fnCaption(stat, b.gain)}</span>
            <span className="nf-btn-c" title={`Costs ${exact(b.cost)} ${pays.name}${afford ? "" : `, you have ${exact(s[b.pays] as number)}`}`}>{fmt(b.cost)} {pays.short}{owned > 0 && <em> · ×{owned}</em>}{eta > 0 && <em className="nf-eta"> · {eta < 86400 * 30 ? fmtTime(eta) : "a long while"}</em>}</span>
        </button>
    );
}

const DRONE_DOT = ["#2fd8e8", "#b6f04a", "#f08a3c", "#7aa2ff", "#e08cff", "#ffc53a"];
/** The Drones posted to this zone (a blinking light each, in the Drone's colour) and the zone's mastery rank. */
function PostedHere({ s, id }: { s: State; id: ButtonStat }) {
    const here = Array.from({ length: TIERS }, (_, k) => k).filter((k) => s.drones[k] > 0 && postOf(s, k) === id);
    const r = zoneRank(s, id);
    if (!here.length && !r) return null;
    return (
        <span className="nf-arm-post" aria-label={`${here.length} Drone${here.length === 1 ? "" : "s"} posted here, mastery ${r ? ROMAN[r] : "none"}`}>
            {here.map((k) => <i key={k} style={{ ["--d" as string]: DRONE_DOT[k] } as CSSProperties} />)}
            {here.length > 0 && <span>posted</span>}
            {r > 0 && <b>mastery {ROMAN[r]}</b>}
        </span>
    );
}
