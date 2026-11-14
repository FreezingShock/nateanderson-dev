"use client";

import { useEffect, useRef, useState } from "react";
import "./production-window.css";
import type { NumberFormat, ResourceView, StatLine } from "@/lib/automation/types";
import { ArtDivider, ArtGauge, EmptyState } from "@/components/brasswork-art";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { fmtNum } from "./format";
import { Glyph } from "./resource-strip";

export type ProductionLayout = "ledger" | "board";

const SAMPLES = 30; // one sample every 2 s: the last minute
const SAMPLE_MS = 2000;

const stat = (stats: StatLine[], label: string) => stats.find((s) => s.label === label)?.value ?? "–";

/** "120 / 200 kW" from the sim's Power stat line. */
function parsePower(stats: StatLine[]) {
  const m = /(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/.exec(stat(stats, "Power"));
  return { supply: m ? Number(m[1]) : 0, demand: m ? Number(m[2]) : 0 };
}

const perMin = (n: number) => `${n > 0 ? "+" : ""}${fmtNum(Math.round(n * 60 * 10) / 10)}/min`;

/** Brass pressure-gauge emblem with a gear, drawn on a 16 px grid so it stays crisp at 2x. */
function Emblem() {
  const brass = "#d29a3c", hi = "#f4cf7e", dk = "#6a4a22", ink = "#2a1606";
  return (
    <svg className="ps-emblem" viewBox="0 0 32 24" width="40" height="30" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="6" y="2" width="20" height="20" fill={dk} />
      <rect x="7" y="3" width="18" height="18" fill={brass} />
      <rect x="9" y="5" width="14" height="14" fill={ink} />
      {[10, 13, 16, 19].map((x) => <rect key={x} x={x} y="6" width="1" height="2" fill={hi} />)}
      <rect x="10" y="9" width="12" height="1" fill="#3a2410" />
      <rect x="15" y="10" width="1" height="6" fill="#e8553a" />
      <rect x="16" y="9" width="1" height="2" fill="#e8553a" />
      <rect x="14" y="15" width="4" height="3" fill={hi} />
      <rect x="2" y="9" width="4" height="6" fill={dk} />
      <rect x="3" y="10" width="2" height="4" fill={brass} />
      <rect x="26" y="9" width="4" height="6" fill={dk} />
      <rect x="27" y="10" width="2" height="4" fill={brass} />
      <rect x="12" y="0" width="8" height="2" fill={hi} />
    </svg>
  );
}

function Spark({ values, max }: { values: number[]; max: number }) {
  const w = 72, h = 18;
  if (values.length < 2) return <svg className="ps-spark" width={w} height={h} aria-hidden="true" />;
  const pts = values.map((v, i) => `${((i / (SAMPLES - 1)) * w).toFixed(1)},${(h - 1 - (Math.abs(v) / max) * (h - 3)).toFixed(1)}`);
  return (
    <svg className="ps-spark" width={w} height={h} aria-hidden="true">
      <polyline points={pts.join(" ")} fill="none" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Centred Production window: facts strip, power gauge, and a per-minute ledger of every item. */
export function ProductionWindow({
  resources,
  stats,
  numberFormat,
  layout: layoutProp = "ledger",
  onClose,
}: {
  resources: ResourceView[];
  stats: StatLine[];
  numberFormat: NumberFormat;
  layout?: ProductionLayout;
  onClose: () => void;
}) {
  // ?ps=board previews the two-column layout while the look is being picked.
  const [layout] = useState<ProductionLayout>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ps") === "board" ? "board" : layoutProp,
  );
  const latest = useRef(resources);
  latest.current = resources;
  const [history, setHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const take = () =>
      setHistory((h) => {
        const next: Record<string, number[]> = {};
        for (const r of latest.current) next[r.id] = [...(h[r.id] ?? []), r.perSecond].slice(-SAMPLES);
        return next;
      });
    take();
    const t = window.setInterval(take, SAMPLE_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const power = parsePower(stats);
  const sat = power.demand <= 0 ? 1 : Math.min(1, power.supply / power.demand);
  const short = power.demand > 0 && power.supply < power.demand;
  const active = resources.filter((r) => Math.abs(r.perSecond) > 0.0001);
  const idle = resources.filter((r) => Math.abs(r.perSecond) <= 0.0001);
  const maxRate = Math.max(0.01, ...resources.map((r) => Math.abs(r.perSecond)));
  const groups: [string, ResourceView[]][] =
    layout === "board"
      ? [["Raw", active.filter((r) => r.group === "raw")], ["Parts", active.filter((r) => r.group === "part")]]
      : [["Flowing", active]];

  const facts: [string, string][] = [
    ["Day", stat(stats, "Day")],
    ["Time", stat(stats, "Time")],
    ["Wind", stat(stats, "Wind")],
    ["Workshops", stat(stats, "Workshops")],
  ];

  return (
    <MenuWindow title="Production" art={<Emblem />} label="Production stats" onClose={onClose}>
      <div className="ps-wrap ps-body" data-layout={layout}>
          <div className="ps-inner">
            <dl className="ps-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <ArtDivider />

            <section className="ps-power" aria-label="Power" data-short={short}>
              <ArtGauge value={sat} size={64} label="Power supplied" />
              <div className="ps-power-text">
                <span className="ps-kicker">Power</span>
                <span className="ps-power-num">
                  {fmtNum(power.supply)} <i>of</i> {fmtNum(power.demand)} kW
                </span>
                <span className="ps-hint">
                  {power.demand <= 0 ? "Nothing draws power yet." : short ? "Machines are short; add a windmill in range." : "Every machine is fully supplied."}
                </span>
              </div>
            </section>
            <ArtDivider />

            {active.length === 0 ? (
              <EmptyState scene="idle">Nothing is moving yet. Place a drill on a resource node.</EmptyState>
            ) : (
              <div className="ps-groups">
                {groups.map(([label, rows]) =>
                  rows.length === 0 ? null : (
                    <section key={label} className="ps-group" aria-label={label}>
                      <h3 className="ps-kicker">{label} <span className="ps-hint">net per minute</span></h3>
                      <ul>
                        {rows.map((r) => (
                          <li key={r.id} className="ps-row" data-neg={r.perSecond < 0}>
                            <Glyph code={r.glyph} size={26} icon={r.id} />
                            <span className="ps-name">{r.name}</span>
                            <span className="ps-bar" aria-hidden="true">
                              <i style={{ width: `${Math.max(6, (Math.abs(r.perSecond) / maxRate) * 100)}%` }} />
                            </span>
                            <Spark values={history[r.id] ?? []} max={maxRate} />
                            <span className="ps-rate">{perMin(r.perSecond)}</span>
                            <span className="ps-stock">{fmtNum(r.amount, numberFormat)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ),
                )}
              </div>
            )}

            {idle.length > 0 && active.length > 0 && (
              <p className="ps-hint ps-idle">Idle: {idle.map((r) => r.name).join(", ")}</p>
            )}

          </div>
      </div>
    </MenuWindow>
  );
}
