"use client";

import { useEffect, useRef, useState } from "react";
import "./production-window.css";
import type { NumberFormat, ResourceView, StatLine } from "@/lib/automation/types";
import { ArtGauge, EmptyState } from "@/components/brasswork-art";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { fmtNum } from "./format";
import { Glyph } from "./resource-strip";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { itemTip } from "@/lib/automation/tips";
import { DEFAULT_CATALOG } from "@/lib/automation/sim/data";

export type ProductionLayout = "ledger" | "board";

const SAMPLES = 30; // one sample every 2 s: the last minute
const SAMPLE_MS = 2000;

/** Gauge value that starts at 0 and settles on `value` once the window is up, so the needle sweeps. Skipped when motion is off. */
function useSweep(value: number, ref: React.RefObject<HTMLElement | null>) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const root = ref.current?.closest(".ab-root, .bw-root") as HTMLElement | null;
    const off = root?.dataset.reduce === "true" || root?.dataset.lowfx === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (off) { setShown(value); return; }
    const t = window.setTimeout(() => setShown(value), 220);
    return () => window.clearTimeout(t);
  }, [value, ref]);
  return shown;
}

const stat = (stats: StatLine[], label: string) => stats.find((s) => s.label === label)?.value ?? "–";

/** "120 / 200 kW" from the sim's Power stat line. */
function parsePower(stats: StatLine[]) {
  const m = /(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/.exec(stat(stats, "Power"));
  return { supply: m ? Number(m[1]) : 0, demand: m ? Number(m[2]) : 0 };
}

const perMin = (n: number) => `${n > 0 ? "+" : ""}${fmtNum(Math.round(n * 60 * 10) / 10)} per min`;

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

  const power = parsePower(stats);
  const sat = power.demand <= 0 ? 1 : Math.min(1, power.supply / power.demand);
  const short = power.demand > 0 && power.supply < power.demand;
  const active = resources.filter((r) => Math.abs(r.perSecond) > 0.0001).sort((a, b) => b.perSecond - a.perSecond);
  const draining = active.filter((r) => r.perSecond < 0).sort((a, b) => a.amount / -a.perSecond - b.amount / -b.perSecond);
  const top = active.find((r) => r.perSecond > 0);
  const lasts = (r: ResourceView) => {
    const s = r.amount / -r.perSecond;
    return s < 60 ? "under a minute" : s < 3600 ? `about ${Math.round(s / 60)} min` : `about ${Math.round(s / 3600)} h`;
  };
  const idle = resources.filter((r) => Math.abs(r.perSecond) <= 0.0001);
  const maxRate = Math.max(0.01, ...resources.map((r) => Math.abs(r.perSecond)));
  const groups: [string, ResourceView[]][] =
    layout === "board"
      ? [["Raw", active.filter((r) => r.group === "raw")], ["Parts", active.filter((r) => r.group === "part")]]
      : [["Flowing", active]];

  const roomRef = useRef<HTMLElement>(null);
  const sweepPower = useSweep(sat, roomRef);
  const wind = Math.min(1, Math.max(0, (parseFloat(stat(stats, "Wind")) || 0) / 100));
  const isNight = stat(stats, "Time") === "Night";
  const sweepWind = useSweep(wind, roomRef);
  const sweepDay = useSweep(isNight ? 0.12 : 0.88, roomRef);

  return (
    <MenuWindow theme="production" title="Production" variant="settle" art={<Emblem />} label="Production stats" onClose={onClose}>
      <div className="ps-wrap ps-body" data-layout={layout}>
        <dl className="ps-head">
          <div><dt>Items moving</dt><dd>{active.length}<small> of {resources.length}</small></dd></div>
          <div><dt>Top output</dt><dd>{top ? <>{perMin(top.perSecond).replace(" per min", "")}<small> {top.name} / min</small></> : <small>Nothing yet</small>}</dd></div>
          <div data-warn={draining.length > 0}><dt>Running down</dt><dd>{draining.length}<small> {draining.length === 1 ? "item" : "items"}</small></dd></div>
          <div data-warn={short}><dt>Power</dt><dd>{power.demand <= 0 ? <small>Idle</small> : <>{Math.round(sat * 100)}%<small> supplied</small></>}</dd></div>
        </dl>

        {draining.length > 0 && (
          <section className="ps-watch" aria-label="Running down">
            <h3 className="ps-kicker">Watch</h3>
            <ul>
              {draining.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <Glyph code={r.glyph} size={24} icon={r.id} />
                  <span><b>{r.name}</b> is used faster than it is made ({perMin(r.perSecond)}). Stock lasts {lasts(r)}.</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="ps-room" aria-label="Gauge room" ref={roomRef}>
          <div className="ps-dial" data-short={short}>
            <ArtGauge value={sweepPower} size={64} label="Power supplied" />
            <span className="ps-kicker">Power</span>
            <span className="ps-big">{fmtNum(power.supply)} of {fmtNum(power.demand)} kW</span>
            <span className="ps-hint">
              {power.demand <= 0 ? "Nothing needs power yet" : short ? "Short: add a windmill in range" : "Every machine is supplied"}
            </span>
          </div>
          <div className="ps-dial">
            <ArtGauge value={sweepWind} size={64} label="Wind strength" />
            <span className="ps-kicker">Wind</span>
            <span className="ps-big">{stat(stats, "Wind")} strength</span>
            <span className="ps-hint">Windmills give this share of their rated kW</span>
          </div>
          <div className="ps-dial">
            <ArtGauge value={sweepDay} size={64} label={isNight ? "Night" : "Daytime"} />
            <span className="ps-kicker">Workshop {stat(stats, "Workshops")}</span>
            <span className="ps-big">Day {stat(stats, "Day")}</span>
            <span className="ps-hint">{isNight ? "Night" : "Daytime"}</span>
          </div>
        </section>

        <section className="ps-ledger" aria-label="Factory ledger">
          <header className="ps-ledger-head">
            <h3>Factory ledger</h3>
            <span>Net made per minute (made minus used)</span>
          </header>
          {active.length === 0 ? (
            <EmptyState scene="idle">Nothing is being made yet. Place a drill on an ore node, then belt it to the hub.</EmptyState>
          ) : (
            <div className="ps-groups">
              {groups.map(([label, rows]) =>
                rows.length === 0 ? null : (
                  <div key={label} className="ps-group" role="group" aria-label={label}>
                    {layout === "board" && <h4 className="ps-kicker">{label}</h4>}
                    <ul>
                      {rows.map((r, i) => (
                        <li key={r.id} className="ps-row" data-neg={r.perSecond < 0} style={{ ["--ps-i" as string]: i }} {...tipAttr(itemTip(DEFAULT_CATALOG.tree, r.id))}>
                          <Glyph code={r.glyph} size={32} icon={r.id} />
                          <span className="ps-name">{r.name}</span>
                          <span className="ps-bar" aria-hidden="true">
                            <i style={{ width: `${Math.max(6, (Math.abs(r.perSecond) / maxRate) * 100)}%` }} />
                          </span>
                          <Spark values={history[r.id] ?? []} max={maxRate} />
                          <span className="ps-rate">{perMin(r.perSecond)}</span>
                          <span className="ps-stock">{fmtNum(r.amount, numberFormat)} in stock</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}
          {idle.length > 0 && active.length > 0 && (
            <p className="ps-idle">Not moving: {idle.map((r) => r.name).join(", ")}</p>
          )}
        </section>
      </div>
    </MenuWindow>
  );
}
