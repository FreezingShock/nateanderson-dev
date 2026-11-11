"use client";

import { TIERS, TUNE, dronesOpen, droneCost, droneRate, fmt, type State } from "@/lib/nodefarm/engine";

const NAMES = ["Probe", "Courier", "Sweeper", "Warden", "Cascade", "Sovereign"];

/** The Drone bay: one Drone line per button tier. A Drone presses its tier on every armed stat, for free labour and Aether. */
export function DroneBay({ s, open, onToggle, onBuy }: { s: State; open: boolean; onToggle: () => void; onBuy: (tier: number) => void }) {
    if (!dronesOpen(s)) {
        return (
            <article className="nf-row nf-locked" style={{ ["--c" as string]: "#6bffc9" }}>
                <span className="nf-plate"><span className="nf-dr-glyph" aria-hidden="true">▣</span></span>
                <div>
                    <b>ENCRYPTED // Drone bay</b>
                    <small>Mine your first Aether to decrypt.</small>
                </div>
            </article>
        );
    }
    const total = s.drones.reduce((a, b) => a + b, 0);
    const press = s.drones.reduce((a, _, k) => a + droneRate(s, k), 0);
    return (
        <article className="nf-row nf-dr" style={{ ["--c" as string]: "#6bffc9" }} data-open={open ? "true" : "false"}>
            <div className="nf-bar-t">
                <span>BAY // DRONES</span>
                <span className="nf-bar-s">{total > 0 ? `${fmt(press)} presses/s` : "idle"}</span>
                <button type="button" className="nf-fold" aria-expanded={open} aria-controls="nf-body-drones" aria-label={`${open ? "Minimize" : "Expand"} Drone bay`} onClick={onToggle}>
                    <i aria-hidden="true" />
                </button>
            </div>
            <div className="nf-body" id="nf-body-drones">
                <div className="nf-body-in" inert={!open}>
                    <p className="nf-brief">Each Drone presses its tier&apos;s button on every stat you arm in that stat&apos;s zone. Bought with Aether, reset on Ascend, and they keep working at {Math.round(TUNE.drone.offline * 100)}% speed while you are away. Reboots stay manual.</p>
                    <ul className="nf-dr-list">
                        {Array.from({ length: TIERS }, (_, k) => {
                            const lvl = s.drones[k];
                            const maxed = lvl >= TUNE.drone.max;
                            const cost = droneCost(s, k);
                            const afford = !maxed && s.aether >= cost;
                            return (
                                <li key={k} data-on={lvl > 0 ? "" : undefined}>
                                    <span className="nf-dr-n">
                                        <b>T{k + 1} {NAMES[k]}</b>
                                        <small>{lvl > 0 ? `${fmt(droneRate(s, k))} presses/s` : "not built"}</small>
                                    </span>
                                    <span className="nf-dr-pips" aria-label={`Level ${lvl} of ${TUNE.drone.max}`}>
                                        {Array.from({ length: TUNE.drone.max }, (_, i) => <i key={i} data-f={i < lvl ? "" : undefined} />)}
                                    </span>
                                    <button type="button" className="nf-mini" disabled={!afford} onClick={() => onBuy(k)} aria-label={maxed ? `${NAMES[k]} maxed` : `${lvl ? "Upgrade" : "Build"} ${NAMES[k]} for ${fmt(cost)} Aether`}>
                                        {maxed ? "Max" : `${lvl ? "Upgrade" : "Build"} · ${fmt(cost)} AE`}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </article>
    );
}
