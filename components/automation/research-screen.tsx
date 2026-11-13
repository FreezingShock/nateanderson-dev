"use client";

import { useState } from "react";
import "./automation-screens.css";
import type { ResearchNode } from "@/lib/automation/types";
import { Glyph } from "./resource-strip";
import { uiIconStyle } from "@/lib/automation/icons/ui";

const COLUMNS = ["Base", "Parts", "Components", "Clockworks", "Megaproject"];
const X0 = 24;
const Y0 = 64;
const DX = 200;
const DY = 104;
const CARD_W = 170;
const CARD_H = 76;

/** Research tree: five stage columns, node states done, ready and locked, and a detail panel. */
export function ResearchScreen({
  nodes,
  blueprints,
  onResearch,
  onClose,
}: {
  nodes: ResearchNode[];
  blueprints: number;
  onResearch?: (id: string) => void;
  onClose: () => void;
}) {
  const firstReady = nodes.find((n) => n.state === "available") ?? nodes[0];
  const [picked, setPicked] = useState<string | null>(firstReady?.id ?? null);

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sel = picked ? (byId.get(picked) ?? null) : null;
  const rows = Math.max(0, ...nodes.map((n) => n.row)) + 1;
  const width = X0 + COLUMNS.length * DX;
  const height = Y0 + rows * DY;
  const at = (n: ResearchNode) => ({ x: X0 + n.column * DX, y: Y0 + n.row * DY });
  const canResearch =
    !!sel && sel.state === "available" && blueprints >= sel.blueprintCost && !!onResearch;

  return (
    <section className="ab-screen" aria-label="Research">
      <header className="ab-screen-head">
        <h2 className="ab-h"><span className="ab-ico" style={uiIconStyle("research", 20)} aria-hidden="true" />Research</h2>
        <span className="ab-dim">Blueprints {blueprints}</span>
        <button type="button" className="ab-text-btn ab-screen-close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="ab-screen-body">
        <div className="ab-tree-wrap">
          <div className="ab-tree" style={{ width, height }}>
            <svg className="ab-links" width={width} height={height} aria-hidden="true">
              {nodes.flatMap((n) =>
                n.requires.map((rid) => {
                  const r = byId.get(rid);
                  if (!r) return null;
                  const a = at(r);
                  const b = at(n);
                  const x1 = a.x + CARD_W;
                  const y1 = a.y + CARD_H / 2;
                  const x2 = b.x;
                  const y2 = b.y + CARD_H / 2;
                  const mx = (x1 + x2) / 2;
                  const done = r.state === "done";
                  return (
                    <path
                      key={`${rid}-${n.id}`}
                      d={`M${x1} ${y1} H${mx} V${y2} H${x2}`}
                      className="ab-link"
                      data-done={done}
                    />
                  );
                }),
              )}
            </svg>

            {COLUMNS.map((t, i) => (
              <div key={t} className="ab-col" style={{ left: X0 + i * DX }}>
                {i + 1} · {t.toUpperCase()}
              </div>
            ))}

            {nodes.map((n) => {
              const p = at(n);
              return (
                <button
                  key={n.id}
                  type="button"
                  className="ab-node"
                  data-state={n.state}
                  aria-pressed={picked === n.id}
                  style={{ left: p.x, top: p.y, width: CARD_W, height: CARD_H }}
                  onClick={() => setPicked(n.id)}
                >
                  <Glyph code={n.glyph} size={30} />
                  <span className="ab-node-text">
                    <span className="ab-node-cost">
                      {n.state === "done" ? "done" : `${n.blueprintCost} BP`}
                    </span>
                    <span className="ab-node-name">{n.name}</span>
                    <span className="ab-node-sub">
                      {n.state === "locked"
                        ? `needs ${n.requires.length} more`
                        : `unlocks ${n.unlocks.join(", ")}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="ab-panel ab-node-detail" aria-label="Selected research">
          {sel ? (
            <>
              <h3 className="ab-h">{sel.name}</h3>
              <dl className="ab-data">
                <div>
                  <dt>Cost</dt>
                  <dd>{sel.blueprintCost} blueprints</dd>
                </div>
                <div>
                  <dt>You have</dt>
                  <dd>{blueprints}</dd>
                </div>
                <div>
                  <dt>Needs</dt>
                  <dd>
                    {sel.requires.length === 0
                      ? "nothing"
                      : sel.requires
                          .map((id) => byId.get(id)?.name ?? id)
                          .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Unlocks</dt>
                  <dd>{sel.unlocks.join(", ")}</dd>
                </div>
                <div>
                  <dt>State</dt>
                  <dd>
                    {sel.state === "done"
                      ? "researched"
                      : sel.state === "available"
                        ? "ready"
                        : "locked"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="ab-action"
                disabled={!canResearch}
                onClick={() => onResearch?.(sel.id)}
              >
                {sel.state === "done"
                  ? "Researched"
                  : `Research · ${sel.blueprintCost} BP`}
              </button>
            </>
          ) : (
            <p className="ab-dim">Pick a node to see what it needs and unlocks.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
