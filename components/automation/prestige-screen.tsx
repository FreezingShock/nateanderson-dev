"use client";

import { useEffect, useRef, useState } from "react";
import "./prestige-screen.css";
import type { PrestigeSite, PrestigeView } from "@/lib/automation/types";
import { iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import {
    ArtDivider,
    ArtGauge,
    ArtPanel,
    PanelTitle,
    SitePainting,
} from "@/components/brasswork-art";
import { DECOR_EXTRA } from "@/lib/automation/art";

const HOLD_MS = 1200;
const TICK_MS = 30;

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
const PURITY: Record<number, string> = {
    0.5: "Impure",
    1: "Normal",
    2: "Pure",
};

const pct = (x: number) => {
    const v = Math.round((x - 1) * 100);
    return v === 0 ? "Standard" : `${v > 0 ? "+" : ""}${v}%`;
};

/** Four corner brackets, drawn once per framed block. */
const Brackets = () => (
    <>
        <i className="pw-br pw-br-tl" aria-hidden="true" />
        <i className="pw-br pw-br-tr" aria-hidden="true" />
        <i className="pw-br pw-br-bl" aria-hidden="true" />
        <i className="pw-br pw-br-br" aria-hidden="true" />
    </>
);

/** Top-down plan of the site: floor, hub and ore nodes at their real positions. */
function SitePlan({ plan }: { plan: NonNullable<PrestigeSite["plan"]> }) {
    const { width: w, depth: d, hub, nodes } = plan;
    return (
        <svg
            className="pw-plan"
            viewBox={`-2 -2 ${w + 4} ${d + 4}`}
            role="img"
            aria-label="Site plan"
        >
            <rect x={0} y={0} width={w} height={d} className="pw-plan-floor" />
            <path
                d={`M0 ${d / 2}H${w}M${w / 2} 0V${d}`}
                className="pw-plan-grid"
            />
            <rect
                x={hub.x - 1.5}
                y={hub.z - 1.5}
                width={3}
                height={3}
                className="pw-plan-hub"
            />
            {nodes.map((n, i) => (
                <circle
                    key={i}
                    cx={n.x}
                    cy={n.z}
                    r={n.purity >= 2 ? 3.6 : 2.6}
                    fill={ORE_COLORS[n.item] ?? "#999"}
                    className="pw-plan-node"
                />
            ))}
        </svg>
    );
}

/** A bonus as a dial: the needle sits where this site falls between 0.9x and 1.3x. */
function Gauge({ label, value }: { label: string; value: number }) {
    const at = Math.min(1, Math.max(0, (value - 0.9) / 0.4));
    return (
        <div className="pw-gauge">
            <ArtGauge value={at} size={64} label={`${label} ${pct(value)}`} />
            <span className="pw-gauge-label">{label}</span>
            <span
                className="pw-gauge-val"
                data-up={value > 1}
                data-down={value < 1}
            >
                {pct(value)}
            </span>
        </div>
    );
}

/**
 * "Open a new workshop": a centred window over the dimmed game. Pick a site, see it, then hold to confirm.
 * Releasing early resets the hold.
 */
export function PrestigeScreen({
    prestige,
    initialSiteId,
    onConfirm,
    onClose,
}: {
    prestige: PrestigeView;
    /** Site to have selected on open, e.g. chosen in Expedition. */
    initialSiteId?: string;
    onConfirm?: (siteId: string) => void;
    onClose: () => void;
}) {
    const [siteId, setSiteId] = useState<string | null>(
        (prestige.sites.find((s) => s.id === initialSiteId) ?? prestige.sites[0])?.id ?? null
    );
    const [held, setHeld] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
    const site = prestige.sites.find((s) => s.id === siteId) ?? null;
    const canHold = prestige.ready && !!site && !!onConfirm;

    // Exit animation first, then hand control back. Skipped when motion is off.
    const [closing, setClosing] = useState(false);
    const panel = useRef<HTMLDivElement | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestClose = () => {
        if (closeTimer.current) return;
        const still = !panel.current || getComputedStyle(panel.current).animationName === "none";
        if (still) return onClose();
        setClosing(true);
        closeTimer.current = setTimeout(onClose, 170);
    };

    const stop = () => {
        if (timer.current) clearInterval(timer.current);
        timer.current = null;
    };

    useEffect(() => stop, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") requestClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose]);

    const start = () => {
        if (!canHold || timer.current || !site) return;
        let elapsed = 0;
        timer.current = setInterval(() => {
            elapsed += TICK_MS;
            const p = Math.min(1, elapsed / HOLD_MS);
            setHeld(p);
            if (p >= 1) {
                stop();
                onConfirm?.(site.id);
            }
        }, TICK_MS);
    };

    const release = () => {
        stop();
        setHeld(0);
    };

    const pick = (id: string) => {
        release();
        setSiteId(id);
    };

    const reason = !prestige.ready
        ? prestige.requirement
        : site
          ? `Moves your factory to ${site.name}`
          : "Choose a site";

    return (
        <div
            className="pw-scrim"
            onPointerDown={(e) => e.target === e.currentTarget && requestClose()}
        >
            <div className="pw-wrap" data-closing={closing || undefined} ref={panel}>
            <ArtPanel className="pw">
                <section
                    className="pw-in"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Open a new workshop"
                >
                    <header className="pw-head">
                        <div className="pw-head-text">
                            <PanelTitle>Open a new workshop</PanelTitle>
                            {/* Not ready: the footer already says what is missing, so the line is not said twice. */}
                            {prestige.ready && <p className="pw-sub">{prestige.requirement}</p>}
                        </div>
                        <button
                            type="button"
                            className="pw-close"
                            onClick={requestClose}
                            aria-label="Close"
                        >
                            Close
                        </button>
                    </header>
                    <ArtDivider />

                    <div className="pw-body">
                        <div
                            className="pw-picker"
                            role="radiogroup"
                            aria-label="Choose a site"
                        >
                            {prestige.sites.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    role="radio"
                                    aria-checked={s.id === siteId}
                                    className="pw-pick"
                                    data-selected={s.id === siteId}
                                    onClick={() => pick(s.id)}
                                >
                                    <span
                                        className="pw-pick-img"
                                        style={{
                                            backgroundImage: `url(/brasswork/sites/${s.id}.webp)`,
                                        }}
                                        aria-hidden="true"
                                    />
                                    <span className="pw-pick-name">
                                        {s.name}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {site && (
                            <div className="pw-main">
                                <div className="pw-left">
                                    <figure className="pw-view">
                                        <span
                                            className="bwa-gilt"
                                            style={{
                                                ["--bwa-gilt" as string]: `url("${DECOR_EXTRA.gilt.url}")`,
                                            }}
                                        >
                                            {imgFailed[site.id] ? (
                                                <SitePainting
                                                    id={site.id}
                                                    width={420}
                                                    label={site.name}
                                                />
                                            ) : (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    key={site.id}
                                                    src={`/brasswork/sites/${site.id}.webp`}
                                                    alt={`${site.name}: the hub and its ore nodes on bare ground`}
                                                    className="pw-view-img"
                                                    onError={() =>
                                                        setImgFailed((m) => ({
                                                            ...m,
                                                            [site.id]: true,
                                                        }))
                                                    }
                                                />
                                            )}
                                        </span>
                                        <figcaption className="pw-view-cap">
                                            <strong>{site.name}</strong>
                                            <span>{site.blurb}</span>
                                        </figcaption>
                                    </figure>
                                    <div className="pw-carry">
                                        <div>
                                            <h3 className="pw-h">You keep</h3>
                                            <ul className="pw-list">
                                                {prestige.keeps.map((k) => (
                                                    <li
                                                        key={k}
                                                        className="pw-keep"
                                                    >
                                                        {k}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h3 className="pw-h">
                                                You leave behind
                                            </h3>
                                            <ul className="pw-list">
                                                {prestige.leaves.map((k) => (
                                                    <li
                                                        key={k}
                                                        className="pw-leave"
                                                    >
                                                        {k}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="pw-info">
                                    <div className="pw-block">
                                        <h3 className="pw-h">Ore on site</h3>
                                        <div className="pw-ores-row">
                                            <ul className="pw-ores">
                                                {(site.plan?.nodes ?? []).map(
                                                    (n, i) => (
                                                        <li
                                                            key={i}
                                                            className="pw-ore"
                                                            data-pure={
                                                                n.purity >= 2
                                                            }
                                                        >
                                                            <span
                                                                className="pw-ore-ico"
                                                                style={iconStyle(
                                                                    n.item,
                                                                    32
                                                                )}
                                                                aria-hidden="true"
                                                            />
                                                            <span className="pw-ore-name">
                                                                {ORE_NAMES[
                                                                    n.item
                                                                ] ?? n.item}
                                                            </span>
                                                            <span className="pw-ore-q">
                                                                {PURITY[
                                                                    n.purity
                                                                ] ?? "Normal"}
                                                            </span>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                            {site.plan && (
                                                <SitePlan plan={site.plan} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="pw-block">
                                        <h3 className="pw-h">Bonuses</h3>
                                        {site.plan && (
                                            <>
                                                <Gauge
                                                    label="Miners"

                                                    value={site.plan.miner}
                                                />
                                                <Gauge
                                                    label="Power"

                                                    value={site.plan.power}
                                                />
                                            </>
                                        )}
                                        {site.plan && (
                                            <p className="pw-size">
                                                Floor {site.plan.width} ×{" "}
                                                {site.plan.depth}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <ArtDivider />
                    <footer className="pw-foot">
                        <p className="pw-reason" data-ready={prestige.ready}>
                            {reason}
                        </p>
                        <button
                            type="button"
                            className="pw-hold"
                            disabled={!canHold}
                            onPointerDown={start}
                            onPointerUp={release}
                            onPointerLeave={release}
                            onPointerCancel={release}
                            onKeyDown={(e) => {
                                if (
                                    (e.key === " " || e.key === "Enter") &&
                                    !e.repeat
                                )
                                    start();
                            }}
                            onKeyUp={release}
                        >
                            <span
                                className="pw-hold-fill"
                                style={{ width: `${held * 100}%` }}
                                aria-hidden="true"
                            />
                            <span className="pw-hold-label">
                                {prestige.ready
                                    ? `Hold to open ${site?.name ?? "a workshop"}`
                                    : "Not ready yet"}
                            </span>
                        </button>
                    </footer>
                </section>
            </ArtPanel>
            </div>
        </div>
    );
}
