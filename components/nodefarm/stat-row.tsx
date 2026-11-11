"use client";

import { useEffect, useRef } from "react";
import { MATS, STATS, TIERS, button, derive, fmt, isUnlocked, statDef, type ButtonStat, type State, type StatId } from "@/lib/nodefarm/engine";
import { LORE } from "@/lib/nodefarm/lore";
import { NfIcon, NfTierIcon, type NfIconName } from "./icon";

type D = ReturnType<typeof derive>;
export type PressFn = (stat: ButtonStat, tier: number, quiet?: boolean) => boolean;

const UNLOCK_HINT: Record<string, string> = {
    reboot: "Earn 600 Bytes in total",
    copper: "Reboot once",
    silicon: "Hold 150 Copper",
    quartz: "Hold 300 Silicon",
    aether: "Hold 500 Quartz",
    runes: "Hold 150 Aether",
    starglass: "Hold 200 Runes",
    voidsteel: "Hold 250 Starglass",
    chrono: "Hold 300 Voidsteel",
};

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
    }
}

/** The signal chain: who boosts whom, with live multipliers. Sits above the stat dossiers. */
export function Chain({ s, d, onAll, allOpen }: { s: State; d: D; onAll: (open: boolean) => void; allOpen: boolean }) {
    const feed: Partial<Record<StatId, string>> = {
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
    return (
        <ol className="nf-chain" aria-label="Signal chain: each stat boosts the next">
            {order.map((def, i) => {
                const open = isUnlocked(s, def.id);
                return (
                    <li key={def.id} data-open={open ? "" : undefined} style={{ ["--c" as string]: def.color }}>
                        <NfIcon name={open ? (def.id as NfIconName) : "lock"} />
                        <b>{def.short}</b>
                        <small>{open ? feed[def.id] : "encrypted"}</small>
                        {i < order.length - 1 && <i aria-hidden="true">▸</i>}
                    </li>
                );
            })}
            <li className="nf-chain-all">
                <button type="button" className="nf-mini" onClick={() => onAll(!allOpen)}>{allOpen ? "Minimize all" : "Expand all"}</button>
            </li>
        </ol>
    );
}

export function StatRow({ id, s, d, onPress, onArm, open: expanded, onToggle }: { id: StatId; s: State; d: D; onPress: PressFn; onArm: () => void; open: boolean; onToggle: () => void }) {
    const def = statDef(id);
    const lore = LORE[id];
    const open = isUnlocked(s, id);
    if (!open) {
        return (
            <article className="nf-row nf-locked" style={{ ["--c" as string]: def.color }}>
                <span className="nf-plate"><NfIcon name="lock" /></span>
                <div>
                    <b>ENCRYPTED // {def.name}</b>
                    <small>{UNLOCK_HINT[id]} to decrypt.</small>
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
    return (
        <article className="nf-row" style={{ ["--c" as string]: def.color }} data-stat={id} data-open={expanded ? "true" : "false"} data-ready={!expanded && ready > 0 ? "" : undefined} onClick={(e) => { if (!expanded && !(e.target as HTMLElement).closest("button")) onToggle(); }}>
            <div className="nf-bar-t">
                <span>ZONE {String(STATS.findIndex((x) => x.id === id) + 1).padStart(2, "0")} // {lore.zone}</span>
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
            <div className="nf-body" id={bodyId}>
                <div className="nf-body-in" inert={!expanded}>
                    <p className="nf-brief">{lore.flavor}</p>
                    <dl className="nf-spec" aria-label="Effects">
                        {effects(id, s, d).map(([k, v]) => (
                            <div key={k}><dt>{k}</dt><i aria-hidden="true" /><dd>{v}</dd></div>
                        ))}
                    </dl>
                    {id !== "bytes" && id !== "reboot" && s.drones.some((x) => x > 0) && (
                        <div className="nf-arm">
                            <span>Drones</span>
                            <button type="button" className="nf-mini" aria-pressed={s.armed.includes(id)} onClick={onArm}>{s.armed.includes(id) ? "Armed" : "Off"}</button>
                        </div>
                    )}
                    {id !== "bytes" && (
                        <div className="nf-btns">
                            {Array.from({ length: TIERS }, (_, k) => (
                                <BuyBtn key={k} s={s} stat={id as ButtonStat} tier={k} onPress={onPress} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </article>
    );
}

// A buy button, skinned per stat in CSS. Press once to buy; hold to keep buying (after 0.4 s, then 10 a second).
function BuyBtn({ s, stat, tier, onPress }: { s: State; stat: ButtonStat; tier: number; onPress: PressFn }) {
    const b = button(s, stat, tier);
    const pays = statDef(b.pays);
    const afford = (s[b.pays] as number) >= b.cost;
    const t = useRef<ReturnType<typeof setTimeout> | null>(null);
    const iv = useRef<ReturnType<typeof setInterval> | null>(null);
    const stop = () => {
        if (t.current) clearTimeout(t.current);
        if (iv.current) clearInterval(iv.current);
        t.current = iv.current = null;
    };
    useEffect(() => stop, []);
    const isReboot = stat === "reboot";
    const name = LORE[stat].tiers[tier];
    const owned = isReboot ? 0 : s.bought[stat][tier];
    return (
        <button
            type="button"
            className="nf-btn"
            data-afford={afford ? "" : undefined}
            data-tier={tier}
            aria-label={`${name}: ${isReboot ? "Reboot for" : "buy"} +${fmt(b.gain)} ${statDef(stat).name} for ${fmt(b.cost)} ${pays.name}${owned ? `, owned ${owned}` : ""}`}
            onPointerDown={(e) => {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                onPress(stat, tier);
                if (isReboot) return;
                stop();
                t.current = setTimeout(() => {
                    iv.current = setInterval(() => {
                        if (!onPress(stat, tier, true)) stop();
                    }, 100);
                }, 400);
            }}
            onPointerUp={stop}
            onPointerLeave={stop}
            onPointerCancel={stop}
            onClick={(e) => e.detail === 0 && onPress(stat, tier)}
            onContextMenu={(e) => e.preventDefault()}
        >
            <span className="nf-btn-top">
                <span className="nf-btn-name">{name}</span>
                <span className="nf-pips" aria-hidden="true">
                    {Array.from({ length: tier + 1 }, (_, i) => <i key={i} />)}
                </span>
            </span>
            <NfTierIcon stat={stat} tier={tier} />
            <span className="nf-btn-g">+{fmt(b.gain)}</span>
            <span className="nf-btn-c">{fmt(b.cost)} {pays.short}{owned > 0 && <em> · ×{owned}</em>}</span>
        </button>
    );
}
