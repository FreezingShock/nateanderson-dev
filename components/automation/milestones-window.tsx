"use client";

/*
 * Contents of the Milestones window (desktop). Reads top to bottom by importance:
 *   1. a summary line of big numbers (blueprints held, milestones delivered, blueprints still to earn),
 *   2. the current milestone as the hero: its crate art, name, reward and what is left to deliver,
 *   3. the route: every milestone in order, done / now / ahead,
 *   4. prestige, with its own header, what it needs, and what carries over.
 * Separation comes from spacing and type size, not boxes: only the hero and the prestige header get a panel.
 */

import type { MilestoneView, PrestigeView } from "@/lib/automation/types";
import { iconStyle } from "@/lib/automation/icons";
import { uiIconStyle } from "@/lib/automation/icons/ui";
import { MilestoneArt } from "@/components/brasswork-art";
import "./milestones-window.css";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { itemTip, milestoneTip } from "@/lib/automation/tips";
import { DEFAULT_CATALOG } from "@/lib/automation/sim/data";

export function MilestonesPanel({ milestones, blueprints, prestige, onPrestige }: {
  milestones: MilestoneView[];
  blueprints: number;
  prestige: PrestigeView;
  onPrestige?: () => void;
}) {
  const current = milestones.find((m) => !m.done);
  const doneCount = milestones.filter((m) => m.done).length;
  const toEarn = milestones.filter((m) => !m.done).reduce((s, m) => s + m.blueprintReward, 0);
  const curIndex = current ? milestones.indexOf(current) : milestones.length;
  const left = current ? current.items.filter((it) => it.have < it.need) : [];

  return (
    <div className="ms">
      <dl className="ms-stats">
        <div><dt>Blueprints</dt><dd><span className="ms-bp" style={uiIconStyle("blueprints", 20)} aria-hidden="true" />{blueprints}</dd></div>
        <div><dt>Delivered</dt><dd>{doneCount}<small> of {milestones.length}</small></dd></div>
        <div><dt>Still to earn</dt><dd>{toEarn}<small> blueprints</small></dd></div>
      </dl>

      {current ? (
        <article className="ms-hero" aria-label={`Current milestone: ${current.name}`}>
          <div className="ms-hero-art"><MilestoneArt id={current.id} width={160} label={current.name} /></div>
          <div className="ms-hero-main">
            <p className="ms-kick">Milestone {curIndex + 1} of {milestones.length}</p>
            <h3 className="ms-hero-name">{current.name}</h3>
            <p className="ms-hero-sub">
              Pays <b>{current.blueprintReward} blueprints</b>
              {" · "}{Math.round(current.progress * 100)}% delivered
              {left.length > 0 ? ` · ${left.length} item${left.length > 1 ? "s" : ""} left` : " · ready to ship"}
            </p>
            <ul className="ms-items">
              {current.items.map((it) => {
                const pct = it.need > 0 ? Math.min(100, Math.round((it.have / it.need) * 100)) : 100;
                return (
                  <li key={it.id} data-done={it.have >= it.need} {...tipAttr(itemTip(DEFAULT_CATALOG.tree, it.id))}>
                    <span className="ms-item-ico" style={iconStyle(it.id, 28)} aria-hidden="true" />
                    <span className="ms-item-name">{it.name}</span>
                    <span className="ms-item-count"><b>{it.have}</b> / {it.need}</span>
                    <span className="ms-bar" role="progressbar" aria-label={`${it.name} delivered`} aria-valuemin={0} aria-valuemax={it.need} aria-valuenow={it.have}>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </article>
      ) : (
        <p className="ms-all">Every milestone is delivered. The workshop is ready to move on.</p>
      )}

      <section aria-label="Milestone route">
        <h4 className="ms-h">Route</h4>
        <ol className="ms-route">
          {milestones.map((m, i) => {
            const state = m.done ? "done" : i === curIndex ? "now" : "ahead";
            return (
              <li key={m.id} data-state={state} {...tipAttr(milestoneTip(m))}>
                <span className="ms-step">{m.done ? "✓" : i + 1}</span>
                <span className="ms-route-name">{m.name}</span>
                <span className="ms-route-meta">{m.done ? "Delivered" : `+${m.blueprintReward}`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="ms-prestige" data-ready={prestige.ready} aria-label="Prestige">
        <header className="ms-prestige-head">
          <span className="ms-prestige-ico" style={uiIconStyle("prestige", 32)} aria-hidden="true" />
          <div>
            <p className="ms-kick">Prestige</p>
            <h3 className="ms-prestige-name">Open a new workshop</h3>
          </div>
          <span className="ms-prestige-state">{prestige.ready ? "Ready" : "Not yet"}</span>
        </header>
        <p className="ms-prestige-need">{prestige.requirement}</p>
        <div className="ms-carry">
          <div><h5>Keeps</h5><p>{prestige.keeps.length ? prestige.keeps.join(", ") : "Blueprints, research and records"}</p></div>
          <div><h5>Leaves behind</h5><p>{prestige.leaves.length ? prestige.leaves.join(", ") : "Machines, belts and stock"}</p></div>
        </div>
        <button type="button" className="ab-action ms-prestige-btn" disabled={!onPrestige} onClick={onPrestige}>
          {prestige.ready ? "Choose a new island" : "See the islands"}
        </button>
      </section>
    </div>
  );
}
