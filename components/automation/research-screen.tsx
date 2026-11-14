"use client";

import { useEffect, useMemo, useState } from "react";
import "./research-screen.css";
import type { MilestoneView, ResearchNode } from "@/lib/automation/types";
import { RECIPE_TREE } from "@/lib/automation/data/tree";
import { iconCell, iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { ArtPanel, PanelTitle, ResearchArt } from "@/components/brasswork-art";

/** Tier headings, left to right. A node sits one column right of its deepest prerequisite. */
const TIERS = ["Base", "Parts", "Components", "Clockworks", "Megaproject"];
const CW = 132; // card width
const CH = 138; // card height
const GX = 36; // gap between columns (links run here)
const GY = 12; // gap between rows
const TOP = 30; // room for the tier headings

type Status = "done" | "ready" | "short" | "locked";

const itemName = new Map(RECIPE_TREE.items.map((i) => [i.id, i.name]));
const machineName = new Map(RECIPE_TREE.machines.map((m) => [m.id, m.name]));
const recipeById = new Map(RECIPE_TREE.recipes.map((r) => [r.id, r]));
const defById = new Map(RECIPE_TREE.research.map((d) => [d.id, d]));

/** Alternate-recipe nodes are optional side branches; they sit under the tree, not in it. */
const isAlternate = (id: string) => {
    const d = defById.get(id);
    return !!d && d.recipes.length > 0 && d.recipes.every((r) => recipeById.get(r)?.alternate);
};

const bp = (n: number) => `${n} BP`;

/** Row order inside each column: sweep left to right then back, ordering by the mean row of neighbours. */
function layout(main: ResearchNode[]) {
    const cols = new Map<number, ResearchNode[]>();
    for (const n of main) (cols.get(n.column) ?? cols.set(n.column, []).get(n.column)!).push(n);
    const nCols = Math.max(0, ...main.map((n) => n.column)) + 1;
    const row = new Map<string, number>();
    for (const list of cols.values()) list.forEach((n, i) => row.set(n.id, i));
    const children = new Map<string, string[]>();
    for (const n of main) for (const r of n.requires) (children.get(r) ?? children.set(r, []).get(r)!).push(n.id);
    const mean = (ids: string[], fallback: number) => {
        const v = ids.map((i) => row.get(i)).filter((x): x is number => x !== undefined);
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : fallback;
    };
    const resort = (c: number, pull: (n: ResearchNode) => string[]) => {
        const list = cols.get(c);
        if (!list) return;
        const key = new Map(list.map((n, i) => [n.id, mean(pull(n), i)]));
        list.sort((a, b) => key.get(a.id)! - key.get(b.id)!);
        list.forEach((n, i) => row.set(n.id, i));
    };
    for (let pass = 0; pass < 3; pass++) {
        for (let c = 1; c < nCols; c++) resort(c, (n) => n.requires);
        for (let c = nCols - 2; c >= 0; c--) resort(c, (n) => children.get(n.id) ?? []);
    }
    return { row, nCols, rows: Math.max(0, ...[...cols.values()].map((l) => l.length)) };
}

function Card({
  n,
  status,
  need,
  selected,
  related,
  style,
  onPick,
}: {
  n: ResearchNode;
  status: Status;
  need: number;
  selected: boolean;
  related: boolean;
  style?: React.CSSProperties;
  onPick: () => void;
}) {
  const line =
    status === "done"
      ? "Researched"
      : status === "ready"
        ? `${bp(n.blueprintCost)} · ready`
        : status === "short"
          ? `${bp(n.blueprintCost)} · need ${need} more`
          : "Locked";
  return (
    <button
      type="button"
      className="rs-card"
      data-status={status}
      data-related={related}
      aria-pressed={selected}
      style={style}
      onClick={onPick}
    >
      <span className="rs-card-art">
        <ResearchArt id={n.id} width={96} />
        {status === "done" && <i className="rs-badge rs-badge-done" aria-hidden="true" />}
        {status === "locked" && <i className="rs-badge rs-badge-lock" aria-hidden="true" />}
      </span>
      <span className="rs-card-name">{n.name}</span>
      <span className="rs-card-state">{line}</span>
    </button>
  );
}

/**
 * Research window: a centred window with the five-tier tree on the left and the picked
 * research on the right, in the same frame. Click the dark margin or press Esc to close.
 */
export function ResearchScreen({
  nodes,
  blueprints,
  milestones,
  onResearch,
  onClose,
}: {
  nodes: ResearchNode[];
  blueprints: number;
  milestones?: MilestoneView[];
  onResearch?: (id: string) => void;
  onClose: () => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const statusOf = (n: ResearchNode): Status =>
    n.state === "done" ? "done" : n.state === "locked" ? "locked" : blueprints >= n.blueprintCost ? "ready" : "short";

  const [picked, setPicked] = useState<string | null>(() => {
    const open = nodes.filter((n) => n.state === "available");
    return (open.find((n) => blueprints >= n.blueprintCost) ?? open[0] ?? nodes[0])?.id ?? null;
  });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const main = nodes.filter((n) => !isAlternate(n.id));
  const alts = nodes.filter((n) => isAlternate(n.id));
  const { row, nCols, rows } = useMemo(() => layout(main), [main.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const width = nCols * CW + (nCols - 1) * GX;
  const height = TOP + rows * CH + (rows - 1) * GY;
  const pos = (n: ResearchNode) => ({ x: n.column * (CW + GX), y: TOP + (row.get(n.id) ?? 0) * (CH + GY) });

  const sel = picked ? (byId.get(picked) ?? null) : null;
  const selStatus = sel ? statusOf(sel) : null;
  const related = new Set<string>();
  if (sel) {
    related.add(sel.id);
    sel.requires.forEach((r) => related.add(r));
    nodes.filter((n) => n.requires.includes(sel.id)).forEach((n) => related.add(n.id));
  }

  const doneCount = nodes.filter((n) => n.state === "done").length;
  const nextMs = milestones?.find((m) => !m.done);
  const short = sel && selStatus === "short" ? sel.blueprintCost - blueprints : 0;

  const def = sel ? defById.get(sel.id) : undefined;
  const unlocks = (def?.recipes ?? []).map((rid) => recipeById.get(rid)).filter((r): r is NonNullable<typeof r> => !!r);
  const leadsTo = sel ? nodes.filter((n) => n.requires.includes(sel.id)) : [];
  const tier = sel ? (isAlternate(sel.id) ? "Alternate recipe" : `Tier ${sel.column + 1} · ${TIERS[sel.column] ?? ""}`) : "";
  const missing = sel ? sel.requires.map((r) => byId.get(r)).filter((r): r is ResearchNode => !!r && r.state !== "done") : [];

  const cta =
    !sel ? "" : selStatus === "done" ? "Researched" : selStatus === "locked" ? "Locked" : `Research · ${bp(sel.blueprintCost)}`;
  const why =
    !sel || selStatus === "done" || selStatus === "ready"
      ? ""
      : selStatus === "locked"
        ? `Research ${missing.map((m) => m.name).join(" and ")} first.`
        : `You need ${short} more blueprint${short === 1 ? "" : "s"}.`;

  const cardFor = (n: ResearchNode, style?: React.CSSProperties) => {
    return (
      <Card
        key={n.id}
        n={n}
        status={statusOf(n)}
        need={Math.max(0, n.blueprintCost - blueprints)}
        selected={picked === n.id}
        related={related.has(n.id)}
        style={style}
        onPick={() => setPicked(n.id)}
      />
    );
  };

  return (
    <div className="rs-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <ArtPanel className="rs-win">
        <section role="dialog" aria-label="Research" className="rs-inner">
          <header className="rs-head">
            <div className="rs-bp" aria-label={`${blueprints} blueprints`}>
              <span className="rs-bp-ico" style={uiIconStyle("research", 28)} aria-hidden="true" />
              <span className="rs-bp-num">{blueprints}</span>
              <span className="rs-bp-lab">blueprints</span>
            </div>
            <PanelTitle>Research</PanelTitle>
            <div className="rs-head-r">
              <span className="rs-count">{doneCount} / {nodes.length} researched</span>
              <button type="button" className="ab-text-btn" onClick={onClose}>Close</button>
            </div>
          </header>

          <div className="rs-body">
            <div className="rs-tree-wrap">
              <div className="rs-tree" style={{ width, height }}>
                {TIERS.slice(0, nCols).map((t, i) => (
                  <div key={t} className="rs-tier" style={{ left: i * (CW + GX), width: CW }}>
                    <b>{["I", "II", "III", "IV", "V"][i]}</b> {t}
                  </div>
                ))}
                <svg className="rs-links" width={width} height={height} aria-hidden="true">
                  {main.flatMap((n) =>
                    n.requires.map((rid) => {
                      const r = byId.get(rid);
                      if (!r || isAlternate(rid)) return null;
                      const a = pos(r);
                      const b = pos(n);
                      const x1 = a.x + CW;
                      const y1 = a.y + CH / 2;
                      const x2 = b.x;
                      const y2 = b.y + CH / 2;
                      const mx = (x1 + x2) / 2;
                      const lit = related.has(rid) && related.has(n.id) && !!sel && (sel.id === n.id || sel.id === rid);
                      return (
                        <path
                          key={`${rid}-${n.id}`}
                          d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                          className="rs-link"
                          data-done={r.state === "done"}
                          data-lit={lit}
                        />
                      );
                    }),
                  )}
                </svg>
                {main.map((n) => {
                  const p = pos(n);
                  return cardFor(n, { left: p.x, top: p.y, width: CW, height: CH });
                })}
              </div>

              {alts.length > 0 && (
                <>
                  <div className="rs-sub">
                    Alternate recipes <span>optional · trade speed, yield or ore</span>
                  </div>
                  <div className="rs-alts">{alts.map((n) => cardFor(n, { width: CW, height: CH }))}</div>
                </>
              )}

              <ul className="rs-legend" aria-label="Key">
                <li data-status="done">Researched</li>
                <li data-status="ready">Ready</li>
                <li data-status="short">Need more blueprints</li>
                <li data-status="locked">Locked</li>
              </ul>
            </div>

            <aside className="rs-detail" aria-label="Selected research">
              {sel ? (
                <>
                  <div className="rs-detail-scroll">
                    <div className="rs-detail-art" data-status={selStatus}>
                      <ResearchArt id={sel.id} width={224} label={sel.name} />
                    </div>
                    <div className="rs-detail-tier">{tier}</div>
                    <h3 className="rs-detail-name">{sel.name}</h3>
                    {sel.note ? <p className="rs-detail-note">{sel.note}</p> : null}

                    <div className="rs-cost" data-status={selStatus}>
                      <div>
                        <span>Cost</span>
                        <b>{bp(sel.blueprintCost)}</b>
                      </div>
                      <div>
                        <span>You have</span>
                        <b>{bp(blueprints)}</b>
                      </div>
                      <div className="rs-meter" aria-hidden="true">
                        <i style={{ width: `${Math.min(100, (blueprints / Math.max(1, sel.blueprintCost)) * 100)}%` }} />
                      </div>
                    </div>

                    {short > 0 && (
                      <p className="rs-source">
                        {nextMs ? (
                          <>
                            Next blueprints: <b>{nextMs.name}</b> pays {nextMs.blueprintReward}
                            {nextMs.progress > 0 ? `, ${Math.round(nextMs.progress * 100)}% delivered` : ""}.
                          </>
                        ) : (
                          "Every milestone has paid out. Blueprints come from a new workshop."
                        )}
                      </p>
                    )}

                    {sel.requires.length > 0 && (
                      <>
                        <div className="rs-h">Needs</div>
                        <ul className="rs-list">
                          {sel.requires.map((r) => {
                            const q = byId.get(r);
                            return (
                              <li key={r} data-done={q?.state === "done"}>
                                <button type="button" onClick={() => q && setPicked(q.id)}>
                                  <span className="rs-tick" aria-hidden="true" />
                                  {q?.name ?? r}
                                  <em>{q?.state === "done" ? "researched" : "not yet"}</em>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}

                    <div className="rs-h">Unlocks</div>
                    <ul className="rs-unlocks">
                      {unlocks.map((r) => (
                        <li key={r.id}>
                          <span className="rs-u-ico" style={iconStyle(r.output.item, 36)} aria-hidden="true" data-has={iconCell(r.output.item) !== undefined} />
                          <span className="rs-u-text">
                            <b>
                              {itemName.get(r.output.item) ?? r.output.item}
                              {r.output.qty > 1 ? ` ×${r.output.qty}` : ""}
                            </b>
                            <span>
                              {r.inputs.map((s) => `${s.qty} ${itemName.get(s.item) ?? s.item}`).join(" + ")}
                            </span>
                            <em>
                              {machineName.get(r.machine) ?? r.machine} · {r.craftSeconds}s
                            </em>
                          </span>
                        </li>
                      ))}
                    </ul>

                    {leadsTo.length > 0 && (
                      <>
                        <div className="rs-h">Leads to</div>
                        <ul className="rs-list">
                          {leadsTo.map((q) => (
                            <li key={q.id}>
                              <button type="button" onClick={() => setPicked(q.id)}>
                                {q.name}
                                <em>{bp(q.blueprintCost)}</em>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <div className="rs-detail-foot">
                    <button
                      type="button"
                      className="ab-action rs-go"
                      disabled={selStatus !== "ready" || !onResearch}
                      onClick={() => onResearch?.(sel.id)}
                    >
                      {cta}
                    </button>
                    {why ? <p className="rs-why">{why}</p> : null}
                  </div>
                </>
              ) : (
                <p className="ab-dim">Pick a research to see what it needs and unlocks.</p>
              )}
            </aside>
          </div>
        </section>
      </ArtPanel>
    </div>
  );
}
