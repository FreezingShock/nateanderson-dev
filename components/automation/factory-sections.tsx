"use client";

import { useState, type ReactNode } from "react";
import type { MilestoneView, PrestigeView } from "./types";

/** A collapsible block. The whole header row is the toggle, so a tap on blank space opens it. */
export function Section({
  title,
  meta,
  defaultOpen = true,
  children,
}: {
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="ab-section" data-open={open}>
      <button
        type="button"
        className="ab-section-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
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

export function Milestones({ milestones }: { milestones: MilestoneView[] }) {
  return (
    <ul className="ab-milestones" aria-label="Milestones">
      {milestones.map((m) => (
        <li key={m.id} className="ab-milestone" data-done={m.done}>
          <div className="ab-milestone-top">
            <span className="ab-milestone-name">{m.name}</span>
            <span className="ab-dim">
              {m.done ? "delivered" : `+${m.blueprintReward} blueprint`}
            </span>
          </div>
          <div className="ab-milestone-goal">{m.goal}</div>
          <div
            className="ab-bar"
            role="progressbar"
            aria-label={`${m.name} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(m.progress * 100)}
          >
            <span className="ab-bar-fill" style={{ width: `${Math.round(m.progress * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PrestigeCard({
  prestige,
  onPrestige,
}: {
  prestige: PrestigeView;
  onPrestige?: () => void;
}) {
  return (
    <div className="ab-prestige" data-ready={prestige.ready}>
      <p className="ab-dim">{prestige.requirement}</p>
      <p>{prestige.gain}</p>
      <button
        type="button"
        className="ab-action"
        disabled={!prestige.ready || !onPrestige}
        onClick={onPrestige}
      >
        Open a new workshop
      </button>
    </div>
  );
}
