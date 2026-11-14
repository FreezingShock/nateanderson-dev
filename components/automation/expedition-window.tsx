"use client";

import "./expedition-window.css";
import type { AreaView, PrestigeSite, PrestigeView } from "@/lib/automation/types";
import { iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { MenuWindow } from "@/components/brasswork-ui/window";

const ORE_NAMES: Record<string, string> = {
    iron_ore: "Iron",
    copper_ore: "Copper",
    coal: "Coal",
    quartz: "Quartz",
    aluminium_ore: "Aluminium",
};
const ORE_COLORS: Record<string, string> = {
    iron_ore: "#b4553a",
    copper_ore: "#58b09a",
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
    const currentId = areas.find((a) => a.state === "current")?.id;
    const cells = prestige.sites.map((s) => (s.plan ? s.plan.width * s.plan.depth : 0));
    const maxSide = Math.max(1, ...prestige.sites.map((s) => Math.max(s.plan?.width ?? 0, s.plan?.depth ?? 0)));

    return (
        <MenuWindow size="wide" title="Expedition" art={<span style={uiIconStyle("expedition", 32)} aria-hidden="true" />} onClose={onClose}>
            <div className="ex-root">
                <p className="ex-sub" data-ready={prestige.ready}>
                    {prestige.ready ? "Every milestone is delivered. Pick a site for your next workshop." : prestige.requirement}
                </p>
                    <ul className="ex-grid" aria-label="Island sites">
                        {prestige.sites.map((s) => {
                            const here = s.id === currentId;
                            const open = prestige.ready || areas.find((a) => a.id === s.id)?.state === "open";
                            const plan = s.plan;
                            const size = plan ? floorWord(plan.width * plan.depth, cells) : "";
                            return (
                                <li key={s.id} className="ex-card" data-here={here}>
                                    <div className="ex-view">
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
                                        <p className="ex-blurb">{s.blurb}</p>
                                        <div className="ex-mid">
                                            <ul className="ex-ores" aria-label="Ore on site">
                                                {(plan?.nodes ?? []).map((n, i) => (
                                                    <li key={i} className="ex-ore" data-pure={n.purity >= 2} title={`${ORE_NAMES[n.item] ?? n.item}, ${n.purity >= 2 ? "pure" : "normal"}`}>
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
                                            <button
                                                type="button"
                                                className="ex-go"
                                                disabled={!open}
                                                onClick={() => onPlan(s.id)}
                                            >
                                                {open ? "Plan the move" : "Locked"}
                                            </button>
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
