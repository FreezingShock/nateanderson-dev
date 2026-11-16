"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./research-screen.css";
import type { MilestoneView, ResearchNode } from "@/lib/automation/types";
import { RECIPE_TREE } from "@/lib/automation/data/tree";
import { iconCell, iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { ResearchArt } from "@/components/brasswork-art";
import { MenuWindow } from "@/components/brasswork-ui/window";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { researchTip } from "@/lib/automation/tips";

/** Tier headings, left to right. A node sits one column right of its deepest prerequisite. */
const TIERS = ["Base", "Parts", "Components", "Clockworks", "Megaproject"];
const CW = 104; // card width
const CH = 122; // card height: art (78 px at CW) plus room for two lines of name
const GX = 22; // gap between columns (links run here)
const GY = 8; // gap between rows
const TOP = 26;
const POPW = 252; // detail pop-up width // room for the tier headings

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
  fresh,
  alt,
  style,
  onPick,
}: {
  n: ResearchNode;
  status: Status;
  need: number;
  selected: boolean;
  related: boolean;
  fresh?: "done" | "open";
  alt: boolean;
  style?: React.CSSProperties;
  onPick: () => void;
}) {
  const line =
    status === "done"
      ? "Researched"
      : status === "ready"
        ? `Ready · ${bp(n.blueprintCost)}`
        : status === "short"
          ? `Needs ${need} more`
          : "Locked";
  return (
    <button
      type="button"
      className="rs-card"
      data-status={status}
      data-alt={alt}
      data-related={related}
      data-fresh={fresh}
      aria-pressed={selected}
      style={style}
      {...tipAttr(researchTip(RECIPE_TREE, n, need))}
      onClick={(e) => {
        e.stopPropagation();
        onPick();
      }}
    >
      <span className="rs-card-art">
        <ResearchArt id={n.id} width={CW} />
        <span className="rs-rib">{line}</span>
      </span>
      <span className="rs-card-name">{n.name}</span>
    </button>
  );
}

/** Main nodes by depth; alternates drop into the free cells at the right of the tree, never left of their prerequisites. */
function layoutAll(nodes: ResearchNode[]) {
  const main = nodes.filter((n) => !isAlternate(n.id));
  const alts = nodes.filter((n) => isAlternate(n.id));
  const { row, nCols, rows } = layout(main);
  const cell = new Map<string, { col: number; row: number }>();
  const used = new Set<string>();
  main.forEach((n) => {
    const c = { col: n.column, row: row.get(n.id) ?? 0 };
    cell.set(n.id, c);
    used.add(`${c.col}:${c.row}`);
  });
  let maxRow = rows - 1;
  const order: { col: number; row: number }[] = [];
  for (let c = nCols - 1; c >= 0; c--) for (let r = 0; r <= rows; r++) order.push({ col: c, row: r });
  alts.forEach((n) => {
    const free = order.find((o) => o.col >= Math.min(n.column, nCols - 1) && !used.has(`${o.col}:${o.row}`));
    const c = free ?? { col: nCols - 1, row: ++maxRow };
    used.add(`${c.col}:${c.row}`);
    cell.set(n.id, c);
    maxRow = Math.max(maxRow, c.row);
  });
  return { cell, nCols, rows: maxRow + 1 };
}

/**
 * Research window: the five-tier tree (alternate recipes mixed in, in copper). Clicking a card opens a
 * pop-up beside it with cost, needs, unlocks and the Research button. Click blank paper to close the pop-up.
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

  // Cards that just changed state play a short stamp (researched) or unlock flash; cleared after the animation.
  const prev = useRef<Map<string, Status> | null>(null);
  const [fresh, setFresh] = useState<Record<string, "done" | "open">>({});
  useEffect(() => {
    const now = new Map(nodes.map((n) => [n.id, statusOf(n)] as const));
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const add: Record<string, "done" | "open"> = {};
    now.forEach((st, id) => {
      const was = before.get(id);
      if (!was || was === st) return;
      if (st === "done") add[id] = "done";
      else if (was === "locked") add[id] = "open";
    });
    if (!Object.keys(add).length) return;
    setFresh((f) => ({ ...f, ...add }));
    const t = setTimeout(() => setFresh((f) => { const g = { ...f }; Object.keys(add).forEach((k) => delete g[k]); return g; }), 1400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, blueprints]);

  const [picked, setPicked] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    popRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [picked]);

  const { cell, nCols, rows } = useMemo(() => layoutAll(nodes), [nodes]);
  const width = nCols * CW + (nCols - 1) * GX;
  const height = TOP + rows * CH + (rows - 1) * GY;
  const pos = (id: string) => {
    const c = cell.get(id) ?? { col: 0, row: 0 };
    return { x: c.col * (CW + GX), y: TOP + c.row * (CH + GY) };
  };

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

  // Pop-up sits to the right of its card, or to the left when there is no room; it overlays neighbours on purpose.
  const popPos = (() => {
    if (!sel) return null;
    const p = pos(sel.id);
    const right = p.x + CW + 10 + POPW <= width + 12;
    return { left: right ? p.x + CW + 10 : Math.max(0, p.x - POPW - 10), top: Math.max(0, p.y - 4), side: right ? "right" : "left" };
  })();

  return (
    <MenuWindow
      title="Research"
      theme="research"
      art={<span style={uiIconStyle("research", 28)} aria-hidden="true" />}
      onClose={onClose}
    >
      <div className="rs-inner">
        <div className="rs-head">
          <div className="rs-bp" aria-label={`${blueprints} blueprints`}>
            <span className="rs-bp-num">{blueprints}</span>
            <span className="rs-bp-lab">blueprints</span>
          </div>
          <p className="rs-bp-note">
            Blueprints come from finished milestone crates and are spent here.
            {nextMs ? <> Next: <b>{nextMs.name}</b>, +{nextMs.blueprintReward}.</> : null}
          </p>
          <span className="rs-count">{doneCount}/{nodes.length}</span>
        </div>

        <div className="rs-tree-wrap" onClick={() => setPicked(null)}>
          <div className="rs-tree" style={{ width, height }}>
            {TIERS.slice(0, nCols).map((t, i) => (
              <div key={t} className="rs-tier" style={{ left: i * (CW + GX), width: CW }}>
                <b>{["I", "II", "III", "IV", "V"][i]}</b> {t}
              </div>
            ))}
            <svg className="rs-links" width={width} height={height} aria-hidden="true">
              {nodes.flatMap((n) =>
                n.requires.map((rid) => {
                  const r = byId.get(rid);
                  if (!r) return null;
                  const alt = isAlternate(n.id);
                  const lit = !!sel && related.has(rid) && related.has(n.id) && (sel.id === n.id || sel.id === rid);
                  if (alt && !lit) return null; // copper links to alternates only show for the picked card
                  const a = pos(rid);
                  const b = pos(n.id);
                  const x1 = a.x + CW;
                  const y1 = a.y + CH / 2;
                  const x2 = b.x;
                  const y2 = b.y + CH / 2;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path
                      key={`${rid}-${n.id}`}
                      d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
                      className="rs-link"
                      data-done={r.state === "done"}
                      data-lit={lit}
                      data-alt={alt}
                    />
                  );
                }),
              )}
            </svg>
            {nodes.map((n) => {
              const p = pos(n.id);
              return (
                <Card
                  key={n.id}
                  n={n}
                  status={statusOf(n)}
                  need={Math.max(0, n.blueprintCost - blueprints)}
                  selected={picked === n.id}
                  related={related.has(n.id)}
                  fresh={fresh[n.id]}
                  alt={isAlternate(n.id)}
                  style={{ left: p.x, top: p.y, width: CW, height: CH, ["--col" as string]: n.column }}
                  onPick={() => setPicked(picked === n.id ? null : n.id)}
                />
              );
            })}

            {sel && popPos && (
              <div
                ref={popRef}
                className="rs-pop"
                role="dialog"
                aria-label={sel.name}
                data-status={selStatus}
                data-alt={isAlternate(sel.id)}
                data-side={popPos.side}
                style={{ left: popPos.left, top: popPos.top, width: POPW }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rs-pop-top">
                  <div className="rs-pop-art">
                    <ResearchArt id={sel.id} width={80} label={sel.name} />
                  </div>
                  <div className="rs-pop-id">
                    <div className="rs-pop-tier">{tier}</div>
                    <h3 className="rs-pop-name">{sel.name}</h3>
                    <div className="rs-pop-state">
                      {selStatus === "done" ? "Researched" : selStatus === "ready" ? "Ready to research" : selStatus === "short" ? `Needs ${short} more` : "Locked"}
                    </div>
                  </div>
                  <button type="button" className="rs-pop-x" aria-label="Close details" onClick={() => setPicked(null)}>×</button>
                </div>
                {sel.note ? <p className="rs-pop-note">{sel.note}</p> : null}

                <div className="rs-cost" data-status={selStatus}>
                  <div><span>Cost</span><b>{bp(sel.blueprintCost)}</b></div>
                  <div><span>You have</span><b>{bp(blueprints)}</b></div>
                  <div className="rs-meter" aria-hidden="true">
                    <i style={{ width: `${Math.min(100, (blueprints / Math.max(1, sel.blueprintCost)) * 100)}%` }} />
                  </div>
                </div>
                {short > 0 && (
                  <p className="rs-source">
                    {nextMs ? (
                      <>Next: <b>{nextMs.name}</b> pays {nextMs.blueprintReward}{nextMs.progress > 0 ? `, ${Math.round(nextMs.progress * 100)}% in` : ""}.</>
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
                      <span className="rs-u-ico" style={iconStyle(r.output.item, 32)} aria-hidden="true" data-has={iconCell(r.output.item) !== undefined} />
                      <span className="rs-u-text">
                        <b>{itemName.get(r.output.item) ?? r.output.item}{r.output.qty > 1 ? ` ×${r.output.qty}` : ""}</b>
                        <span>{r.inputs.map((x) => `${x.qty} ${itemName.get(x.item) ?? x.item}`).join(" + ")}</span>
                        <em>{machineName.get(r.machine) ?? r.machine} · {r.craftSeconds}s</em>
                      </span>
                    </li>
                  ))}
                </ul>

                {leadsTo.length > 0 && (
                  <>
                    <div className="rs-h rs-leads">Leads to</div>
                    <ul className="rs-list rs-leads">
                      {leadsTo.map((q) => (
                        <li key={q.id}>
                          <button type="button" onClick={() => setPicked(q.id)}>{q.name}<em>{bp(q.blueprintCost)}</em></button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

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
            )}
          </div>
        </div>

        <ul className="rs-legend" aria-label="Key">
          <li data-status="done">Researched</li>
          <li data-status="ready">Ready</li>
          <li data-status="short">Needs more blueprints</li>
          <li data-status="locked">Locked</li>
          <li data-status="alt">Alternate recipe</li>
        </ul>
      </div>
    </MenuWindow>
  );
}
