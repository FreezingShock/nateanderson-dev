"use client";

import { useState, type ReactNode } from "react";
import type { MilestoneView, PrestigeView } from "@/lib/automation/types";
import { uiIconStyle } from "@/lib/automation/icons/ui";

/** A collapsible block. The whole header row is the toggle, so a tap on blank space opens it. */
export function Section({
  title,
  meta,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  meta?: string;
  /** A HUD glyph id from lib/automation/icons/ui.ts, shown before the title. */
  icon?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ab-section ab-panel" data-open={open}>
      <button
        type="button"
        className="ab-section-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon && <span className="ab-ico" style={uiIconStyle(icon, 20)} aria-hidden="true" />}
        <span className="ab-h">{title}</span>
        {meta && <span className="ab-dim">{meta}</span>}
        <span className="ab-chev" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && <div className="ab-section-body">{children}</div>}
    </section>
  );
}

/**
 * Milestones: the current goal is large with one progress bar per item, finished goals sit in a short
 * list, and the goals still ahead fold into one line so the panel stays short.
 */
export function Milestones({ milestones }: { milestones: MilestoneView[] }) {
  const current = milestones.find((m) => !m.done);
  const done = milestones.filter((m) => m.done);
  const ahead = current ? milestones.slice(milestones.indexOf(current) + 1) : [];
  return (
    <div className="ab-milestones">
      {current && (
        <article className="ab-milestone-now" aria-label={`Current milestone: ${current.name}`}>
          <header className="ab-milestone-now-head">
            <span className="ab-milestone-now-tag">Now</span>
            <span className="ab-milestone-name">{current.name}</span>
            <span className="ab-dim">+{current.blueprintReward} blueprint</span>
          </header>
          {current.rewardLine && <p className="ab-dim ab-milestone-reward">{current.rewardLine}</p>}
          <ul className="ab-milestone-items">
            {current.items.map((it) => {
              const pct = it.need > 0 ? Math.round((it.have / it.need) * 100) : 100;
              return (
                <li key={it.id} className="ab-milestone-item" data-done={it.have >= it.need}>
                  <span className="ab-milestone-item-name">{it.name}</span>
                  <span className="ab-milestone-item-count">{it.have} / {it.need}</span>
                  <span className="ab-bar" role="progressbar" aria-label={`${it.name} delivered`} aria-valuemin={0} aria-valuemax={it.need} aria-valuenow={it.have}>
                    <span className="ab-bar-fill" style={{ width: `${pct}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      )}
      {done.length > 0 && (
        <ul className="ab-milestone-done" aria-label="Delivered milestones">
          {done.map((m) => (
            <li key={m.id} className="ab-milestone-row" data-done="true">
              <span className="ab-milestone-name">{m.name}</span>
              <span className="ab-dim">delivered</span>
            </li>
          ))}
        </ul>
      )}
      {ahead.length > 0 && (
        <details className="ab-milestone-ahead">
          <summary>{ahead.length} more to come</summary>
          <ul>
            {ahead.map((m) => (
              <li key={m.id} className="ab-milestone-row">
                <span className="ab-milestone-name">{m.name}</span>
                <span className="ab-dim">+{m.blueprintReward} blueprint</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function PrestigeCard({
  prestige,
  onOpen,
}: {
  prestige: PrestigeView;
  onOpen?: () => void;
}) {
  return (
    <div className="ab-prestige" data-ready={prestige.ready}>
      <p className="ab-dim">{prestige.requirement}</p>
      <p className="ab-dim">Keeps blueprints, research and records. Leaves machines, belts and stock.</p>
      <button
        type="button"
        className="ab-action"
        disabled={!onOpen}
        onClick={onOpen}
      >
        Open a new workshop
      </button>
    </div>
  );
}
