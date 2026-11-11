"use client";

import { useEffect, useRef } from "react";
import { STATS, TIERS, button, derive, fmt, isUnlocked, statDef, type ButtonStat, type State, type StatId } from "@/lib/nodefarm/engine";
import { LORE } from "@/lib/nodefarm/lore";
import { NfIcon, type NfIconName } from "./icon";

type D = ReturnType<typeof derive>;
export type PressFn = (stat: ButtonStat, tier: number, quiet?: boolean) => boolean;

const UNLOCK_HINT: Record<string, string> = {
    reboot: "Earn 600 Bytes in total",
    copper: "Reboot once",
    silicon: "Hold 150 Copper",
    quartz: "Hold 300 Silicon",
    aether: "Hold 500 Quartz",
};

/** What this stat is doing for you right now, as short live chips. */
function effects(id: StatId, s: State, d: D): string[] {
    switch (id) {
        case "bytes":
            return [`Output +${fmt(d.bytesPerSec)}/s`, `Global ×${fmt(d.global)}`];
        case "mult":
            return [`Adds +1 B/s each`, `Buttons hit ×${fmt(d.multGainMult)}`];
        case "reboot":
            return [`+${fmt(d.rebootStrength * 100)}% per Reboot`, `Resets Bytes and Multipliers`];
        case "copper":
            return [`▸ Reboot power ×${fmt(d.boosts.cuReboot)}`, `▸ Bytes ×${fmt(d.boosts.cuBytes)}`];
        case "silicon":
            return [`▸ Copper output ×${fmt(d.boosts.siCu)}`];
        case "quartz":
            return [`▸ Silicon output ×${fmt(d.boosts.qzSi)}`];
        case "aether":
            return [`▸ Quartz output ×${fmt(d.boosts.aeQz)}`, `Unlocks Ascend`];
    }
}

/** The signal chain: who boosts whom, with live multipliers. Sits above the stat dossiers. */
export function Chain({ s, d, onAll, allOpen }: { s: State; d: D; onAll: (open: boolean) => void; allOpen: boolean }) {
    const feed: Partial<Record<StatId, string>> = {
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

export function StatRow({ id, s, d, onPress, open: expanded, onToggle }: { id: StatId; s: State; d: D; onPress: PressFn; open: boolean; onToggle: () => void }) {
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
    const rate = id === "bytes" ? d.bytesPerSec : id === "copper" || id === "silicon" || id === "quartz" || id === "aether" ? d.rates[id] : 0;
    const prod = id === "copper" || id === "silicon" || id === "quartz" || id === "aether" ? s.prod[id] : 0;
    const buttons = id === "bytes" ? 0 : TIERS;
    const ready = id === "bytes" ? 0 : Array.from({ length: TIERS }, (_, k) => k).filter((k) => (s[button(s, id as ButtonStat, k).pays] as number) >= button(s, id as ButtonStat, k).cost).length;
    const bodyId = `nf-body-${id}`;
    return (
        <article className="nf-row" style={{ ["--c" as string]: def.color }} data-stat={id} data-open={expanded ? "true" : "false"} data-ready={!expanded && ready > 0 ? "" : undefined}>
            <header className="nf-row-h">
                <span className="nf-plate"><NfIcon name={id as NfIconName} responsive /></span>
                <div className="nf-row-t">
                    <b>{def.name} <em>{def.short}</em></b>
                    <span className="nf-code">ZONE // {lore.zone}</span>
                </div>
                <div className="nf-row-n">
                    <b>{fmt(amt)}</b>
                    {rate > 0 && <small>+{fmt(rate)}/s</small>}
                    {!expanded && buttons > 0 ? <small className="nf-sum">{ready}/{buttons} ready</small> : prod > 0 ? <small>{fmt(prod)} nodes</small> : null}
                </div>
                <button type="button" className="nf-fold" aria-expanded={expanded} aria-controls={bodyId} aria-label={`${expanded ? "Minimize" : "Expand"} ${def.name}`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </header>
            <div className="nf-body" id={bodyId}>
                <div className="nf-body-in" inert={!expanded}>
                    <div className="nf-brief">
                        <span className="nf-brief-code">{lore.code}</span>
                        <p>{lore.flavor}</p>
                    </div>
                    <ul className="nf-chips" aria-label="Effects">
                        {effects(id, s, d).map((c) => <li key={c}>{c}</li>)}
                    </ul>
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
            <span className="nf-btn-g">+{fmt(b.gain)}</span>
            <span className="nf-btn-c">{fmt(b.cost)} {pays.short}{owned > 0 && <em> · ×{owned}</em>}</span>
        </button>
    );
}
