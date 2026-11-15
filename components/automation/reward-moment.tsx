"use client";

// The reward moment: when an order, milestone or commission is filled, a brass card drops in over the island showing
// what was gained (blueprints and the supply crate, with their real icons) and what it opened. It never blocks the
// game: it sits at the top, leaves by itself after a few seconds (hover or focus holds it), and the next one waits in line.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArtIcon, UiArtIcon } from "@/components/brasswork-art/icons";
import { MilestoneArt } from "@/components/brasswork-art";
import { MILESTONE_ART } from "@/lib/automation/art";
import type { HubView } from "@/lib/automation/types";
import { diffRewards, type RewardEvent, type RewardMemory } from "@/lib/brasswork/rewards";
import "./reward-moment.css";

/** Fired on window for every reward, so sound or other layers can listen without touching this file. */
export const REWARD_EVENT = "bw:reward";

const KICKER: Record<RewardEvent["kind"], string> = { order: "Order filled", milestone: "Milestone reached", commission: "Commission filled" };
const HOLD_MS = 7500;
const LEAVE_MS = 260;

/** Counts up to `to` over about half a second. Reads as a fresh payout; skipped when motion is off. */
function useCount(to: number, still: boolean): number {
    const [n, setN] = useState(still ? to : 0);
    useEffect(() => {
        if (still || to <= 0) { setN(to); return; }
        let raf = 0;
        const t0 = performance.now();
        const tick = (t: number) => {
            const k = Math.min(1, (t - t0) / 650);
            setN(Math.round(to * (1 - (1 - k) * (1 - k))));
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [to, still]);
    return n;
}

function Card({ ev, queued, onOpenHub, onOpenResearch, onDone }: {
    ev: RewardEvent; queued: number; onOpenHub: () => void; onOpenResearch: () => void; onDone: () => void;
}) {
    const [leaving, setLeaving] = useState(false);
    const [held, setHeld] = useState(false);
    const still = typeof document !== "undefined" && !!document.querySelector('.ab-root[data-reduce="true"], .ab-root[data-lowfx="true"]');
    const bp = useCount(ev.blueprints, still);
    const dismiss = useCallback(() => setLeaving(true), []);
    useEffect(() => {
        if (leaving) { const t = window.setTimeout(onDone, still ? 0 : LEAVE_MS); return () => window.clearTimeout(t); }
        if (held) return;
        const t = window.setTimeout(dismiss, queued > 0 ? 4200 : HOLD_MS);
        return () => window.clearTimeout(t);
    }, [leaving, held, queued, still, onDone, dismiss]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [dismiss]);

    const art = ev.kind === "milestone" && MILESTONE_ART[ev.id] !== undefined;
    const gained = ev.blueprints > 0 || ev.crate.length > 0;
    return (
        <div
            className="rm-card"
            role="status"
            data-kind={ev.kind}
            data-leaving={leaving ? "true" : undefined}
            onMouseEnter={() => setHeld(true)}
            onMouseLeave={() => setHeld(false)}
            onFocus={() => setHeld(true)}
            onBlur={() => setHeld(false)}
        >
            <i className="rm-gleam" aria-hidden="true" />
            <header className="rm-head">
                <span className="rm-kick">{KICKER[ev.kind]}</span>
                {queued > 0 && <span className="rm-more">{queued} more</span>}
                <button type="button" className="rm-x" aria-label="Dismiss" onClick={dismiss}><UiArtIcon id="close" size={16} /></button>
            </header>
            <div className="rm-body">
                {art && <MilestoneArt id={ev.id} width={128} />}
                <div className="rm-main">
                    <h3 className="rm-title">{ev.title}</h3>
                    {gained && (
                        <ul className="rm-gain" aria-label="Gained">
                            {ev.blueprints > 0 && (
                                <li className="rm-tile" data-kind="blueprints" style={{ ["--i" as string]: 0 }}>
                                    <UiArtIcon id="blueprints" size={48} name="Blueprints" />
                                    <b>+{bp}</b>
                                    <span>blueprints</span>
                                </li>
                            )}
                            {ev.crate.map((c, i) => (
                                <li key={c.item} className="rm-tile" data-kind="crate" style={{ ["--i" as string]: i + 1 }}>
                                    <ArtIcon id={c.item} size={48} name={c.name} />
                                    <b>+{c.qty}</b>
                                    <span>{c.name}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {ev.crate.length > 0 && <p className="rm-note">The crate is in the hub, ready to use.</p>}
                    {ev.opened.length > 0 && (
                        <p className="rm-opened"><span>Opened</span> {ev.opened.map((u) => u.name).join(", ")}</p>
                    )}
                </div>
            </div>
            <footer className="rm-foot">
                {ev.blueprints > 0 && <button type="button" className="rm-btn" onClick={() => { dismiss(); onOpenResearch(); }}>Spend blueprints</button>}
                <button type="button" className="rm-btn" data-quiet="true" onClick={() => { dismiss(); onOpenHub(); }}>Open hub</button>
            </footer>
            <span className="rm-timer" aria-hidden="true" data-held={held ? "true" : undefined} style={{ animationDuration: `${queued > 0 ? 4200 : HOLD_MS}ms` }} />
        </div>
    );
}

export function RewardMoment({ hub, onOpenHub, onOpenResearch }: { hub: HubView; onOpenHub: () => void; onOpenResearch: () => void }) {
    const memory = useRef<RewardMemory | null>(null);
    const [queue, setQueue] = useState<RewardEvent[]>([]);
    useEffect(() => {
        const { memory: next, events } = diffRewards(memory.current, hub);
        memory.current = next;
        if (events.length === 0) return;
        setQueue((q) => [...q, ...events.filter((e) => !q.some((x) => x.key === e.key))]);
        for (const e of events) window.dispatchEvent(new CustomEvent(REWARD_EVENT, { detail: { kind: e.kind, id: e.id } }));
    }, [hub]);
    const next = useCallback(() => setQueue((q) => q.slice(1)), []);
    const ev = queue[0];
    if (!ev) return null;
    return <Card key={ev.key} ev={ev} queued={queue.length - 1} onOpenHub={onOpenHub} onOpenResearch={onOpenResearch} onDone={next} />;
}
