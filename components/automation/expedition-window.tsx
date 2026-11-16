"use client";

import "./expedition-window.css";
import type { AreaView, PrestigeSite, PrestigeView } from "@/lib/automation/types";
import { useRef, useState } from "react";
import { iconStyle } from "@/lib/automation/icons";
import { uiIconStyle, type UiIconId } from "@/lib/automation/icons/ui";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { tipAttr } from "@/components/brasswork-ui/tip";

const ORE_NAMES: Record<string, string> = {
    iron_ore: "Iron",
    copper_ore: "Copper",
    coal: "Coal",
    quartz: "Quartz",
    aluminium_ore: "Aluminium",
};
const ORE_COLORS: Record<string, string> = {
    iron_ore: "#b4553a",
    copper_ore: "#8f9650",
    coal: "#6b6b78",
    quartz: "#f2cfe0",
    aluminium_ore: "#98b2d4",
};

const pct = (x: number) => {
    const v = Math.round((x - 1) * 100);
    return v === 0 ? "standard" : `${v > 0 ? "+" : ""}${v}%`;
};

/** Floor size in words, so 56 by 56 means something: small, medium or large next to the other sites. */
function floorWord(cells: number, all: number[]) {
    const min = Math.min(...all);
    const max = Math.max(...all);
    if (max === min) return "Medium";
    const t = (cells - min) / (max - min);
    return t < 0.25 ? "Small" : t > 0.75 ? "Large" : "Medium";
}

/** Top-down plan: the floor at its real proportions, the hub and the ore nodes where they sit. */
function Plan({ plan, scale }: { plan: NonNullable<PrestigeSite["plan"]>; scale: number }) {
    const { width: w, depth: d, hub, nodes } = plan;
    return (
        <svg
            className="ex-plan"
            width={Math.round(w * scale)}
            height={Math.round(d * scale)}
            viewBox={`0 0 ${w} ${d}`}
            role="img"
            aria-label={`Floor plan, ${w} by ${d} cells`}
        >
            <rect x={0} y={0} width={w} height={d} className="ex-plan-floor" />
            <rect x={hub.x - 1.5} y={hub.z - 1.5} width={3} height={3} className="ex-plan-hub" />
            {nodes.map((n, i) => (
                <circle key={i} cx={n.x} cy={n.z} r={n.purity >= 2 ? 3.6 : 2.6} fill={ORE_COLORS[n.item] ?? "#999"} className="ex-plan-node" />
            ))}
        </svg>
    );
}

/** What a locked site waits for: the next milestone still open, and how many follow it. The full list sits in the tooltip. */
function LockNote({ names }: { names: string[] }) {
    if (names.length === 0) return null;
    const [next, ...rest] = names;
    return (
        <p className="ex-need" {...tipAttr({ title: "Still to finish", tag: "Milestones", text: `Deliver these to open the islands: ${names.join(", ")}.` })}>
            <span className="ex-need-ico" style={uiIconStyle("lock", 16)} aria-hidden="true" />
            <span>
                <span className="ex-need-word">Missing </span>
                <b>{next}</b>
                {rest.length > 0 && (
                    <span className="ex-need-more">
                        , +{rest.length}
                        <span className="ex-need-word"> more</span>
                    </span>
                )}
            </span>
        </p>
    );
}

/** Glyph for a keep or leave line, picked from its wording. Each has its own drawing in the brass keep/leave set. */
function carryIcon(text: string, leave: boolean): UiIconId {
    const t = text.toLowerCase();
    if (leave) return t.includes("stock") ? "leave_stock" : t.includes("fleet") || t.includes("expedition") ? "leave_fleets" : "leave_machines";
    if (t.includes("blueprint") || t.includes("research")) return "keep_plans";
    if (t.includes("design")) return "keep_designs";
    if (t.includes("route")) return "keep_routes";
    if (t.includes("free machine")) return "keep_free";
    return "keep_records";
}

/** A row of identical tiles, one glyph each; the full wording sits in the tooltip and the accessible name. */
function Carry({ label, sign, items }: { label: string; sign: string; items: string[] }) {
    const leave = label === "Leave";
    return (
        <div className="ex-carry" data-kind={label.toLowerCase()} role="group" aria-label={`${label}: ${items.join(", ")}`}>
            <span className="ex-carry-label">
                <b aria-hidden="true">{sign}</b> {label}
            </span>
            {items.map((t) => (
                <span key={t} className="ex-carry-tile" title={t} tabIndex={0} aria-label={t}>
                    <span className="ex-carry-ico" style={uiIconStyle(carryIcon(t, leave), 24)} aria-hidden="true" />
                </span>
            ))}
        </div>
    );
}

/**
 * Expedition: a centred window listing every island site as a card. It is the front door of "open a new workshop":
 * a site's button hands over to the workshop selection screen with that site already chosen.
 */
export function ExpeditionWindow({
    areas,
    prestige,
    onPlan,
    onClose,
}: {
    areas: AreaView[];
    prestige: PrestigeView;
    /** Open the workshop selection screen with this site chosen. */
    onPlan: (siteId: string) => void;
    onClose: () => void;
}) {
    // Hand-off: the chosen card flashes and the others dim, then the workshop screen opens.
    const [picked, setPicked] = useState<string | null>(null);
    const timer = useRef<number | null>(null);
    const choose = (id: string) => {
        if (timer.current !== null) return;
        setPicked(id);
        timer.current = window.setTimeout(() => onPlan(id), 240);
    };
    const currentId = areas.find((a) => a.state === "current")?.id;
    const cells = prestige.sites.map((s) => (s.plan ? s.plan.width * s.plan.depth : 0));
    const maxSide = Math.max(1, ...prestige.sites.map((s) => Math.max(s.plan?.width ?? 0, s.plan?.depth ?? 0)));

    return (
        <MenuWindow size="wide" variant="shutter" theme="expedition" title="Expedition" art={<span className="ex-compass" style={uiIconStyle("expedition", 32)} aria-hidden="true" />} onClose={onClose}>
            <div className="ex-root">
                <div className="ex-brief">
                    <i className="ex-scan" aria-hidden="true" />
                    <p className="ex-lede">Move your workshop to a new island.</p>
                    <Carry label="Keep" sign="+" items={prestige.keeps} />
                    <Carry label="Leave" sign="–" items={prestige.leaves} />
                    {!prestige.ready && <p className="ex-sub">{prestige.requirement}</p>}
                </div>
                <ul className="ex-grid" aria-label="Island sites">
                        {prestige.sites.map((s, i) => {
                            const here = s.id === currentId;
                            const open = prestige.ready || areas.find((a) => a.id === s.id)?.state === "open";
                            const plan = s.plan;
                            const size = plan ? floorWord(plan.width * plan.depth, cells) : "";
                            return (
                                <li key={s.id} className="ex-card" data-here={here} data-picked={picked ? (picked === s.id ? "yes" : "no") : undefined} style={{ ["--ex-i" as string]: i }}>
                                    <div
                                        className="ex-view"
                                        {...tipAttr({
                                            title: s.name,
                                            tag: "Island site",
                                            text: s.blurb,
                                            rows: [
                                                ...(plan ? [{ k: "Floor", v: `${plan.width} × ${plan.depth} cells` }, { k: "Miners", v: pct(plan.miner) }, { k: "Power", v: pct(plan.power) }] : []),
                                                { k: "Status", v: here ? "You are here" : open ? "Open" : "Locked", tone: here || open ? ("good" as const) : undefined },
                                            ],
                                        })}
                                    >
                                        <span className="ex-img" style={{ backgroundImage: `url(/brasswork/sites/${s.id}.webp)` }} aria-hidden="true" />
                                        {plan && (
                                            <span className="ex-plan-wrap">
                                                <Plan plan={plan} scale={40 / maxSide} />
                                            </span>
                                        )}
                                        <h3 className="ex-name">{s.name}</h3>
                                        {here && <span className="ex-here">You are here</span>}
                                    </div>
                                    <div className="ex-body">
                                        <div className="ex-mid">
                                            <ul className="ex-ores" aria-label="Ore on site">
                                                {(plan?.nodes ?? []).map((n, i) => (
                                                    <li key={i} className="ex-ore" style={{ ["--ex-o" as string]: i }} data-pure={n.purity >= 2} {...tipAttr({ title: ORE_NAMES[n.item] ?? n.item, tag: "Ore node", text: "Drills on this node mine it. Pure nodes give twice the normal rate.", rows: [{ k: "Purity", v: n.purity >= 2 ? "Pure" : "Normal" }] })}>
                                                        <span className="ex-ore-ico" style={iconStyle(n.item, 32)} aria-hidden="true" />
                                                        <span className="ex-sr">
                                                            {ORE_NAMES[n.item] ?? n.item}, {n.purity >= 2 ? "pure" : "normal"}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        {plan && (
                                            <p className="ex-facts">
                                                <span>
                                                    {size} floor, {plan.width} × {plan.depth}
                                                </span>
                                                <span>
                                                    Miners {pct(plan.miner)}, power {pct(plan.power)}
                                                </span>
                                            </p>
                                        )}
                                        {here ? (
                                            <p className="ex-state">Your workshop is here now.</p>
                                        ) : (
                                            <>
                                                {!open && <LockNote names={prestige.missing} />}
                                                <button
                                                    type="button"
                                                    className="ex-go"
                                                    disabled={!open}
                                                    {...tipAttr({ title: s.name, tag: "Expedition", text: open ? "Pick this site to plan the move. You confirm it on the next step." : "Locked until every milestone delivery is done." })}
                                                    onClick={() => choose(s.id)}
                                                >
                                                    {open ? (
                                                        "Plan the move"
                                                    ) : (
                                                        <>
                                                            <span className="ex-go-ico" style={uiIconStyle("lock", 14)} aria-hidden="true" />
                                                            Locked
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
            </div>
        </MenuWindow>
    );
}
