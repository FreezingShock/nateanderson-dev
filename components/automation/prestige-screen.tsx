"use client";

import { useEffect, useRef, useState } from "react";
import "./automation-screens.css";
import type { PrestigeView } from "@/lib/automation/types";

const HOLD_MS = 1200;
const TICK_MS = 30;

/**
 * "Open a new workshop": pick one of three sites, then hold to confirm.
 * Releasing early resets the hold.
 */
export function PrestigeScreen({
  prestige,
  onConfirm,
  onClose,
}: {
  prestige: PrestigeView;
  onConfirm?: (siteId: string) => void;
  onClose: () => void;
}) {
  const [siteId, setSiteId] = useState<string | null>(prestige.sites[0]?.id ?? null);
  const [held, setHeld] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const site = prestige.sites.find((s) => s.id === siteId) ?? null;
  const canHold = prestige.ready && !!site && !!onConfirm;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => stop, []);

  const start = () => {
    if (!canHold || timer.current || !site) return;
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += TICK_MS;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHeld(pct);
      if (pct >= 1) {
        stop();
        onConfirm?.(site.id);
      }
    }, TICK_MS);
  };

  const release = () => {
    stop();
    setHeld(0);
  };

  return (
    <section className="ab-screen" aria-label="Open a new workshop">
      <header className="ab-screen-head">
        <h2 className="ab-h">Open a new workshop</h2>
        <span className="ab-dim">{prestige.requirement}</span>
        <button type="button" className="ab-text-btn ab-screen-close" onClick={onClose}>
          Close
        </button>
      </header>

      <div className="ab-screen-body ab-prestige-body">
        <div className="ab-sites" role="radiogroup" aria-label="Choose a site">
          {prestige.sites.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={s.id === siteId}
              className="ab-site"
              data-selected={s.id === siteId}
              onClick={() => {
                release();
                setSiteId(s.id);
              }}
            >
              <span className="ab-site-name">{s.name}</span>
              {s.blurb && <span className="ab-dim">{s.blurb}</span>}
              {s.modifiers && s.modifiers.length > 0 && (
                <span className="ab-site-mods">
                  {s.modifiers.map((m) => (
                    <span key={m} className="ab-site-mod">
                      {m}
                    </span>
                  ))}
                </span>
              )}
            </button>
          ))}
        </div>

        <aside className="ab-panel ab-prestige-lists" aria-label="What carries over">
          <h3 className="ab-h">You keep</h3>
          <ul className="ab-plain">
            {prestige.keeps.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <h3 className="ab-h">You leave behind</h3>
          <ul className="ab-plain ab-dim">
            {prestige.leaves.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="ab-dim">The old workshop stays on the island in Records, still turning.</p>
        </aside>
      </div>

      <div className="ab-hold-row">
        <button
          type="button"
          className="ab-hold"
          disabled={!canHold}
          onPointerDown={start}
          onPointerUp={release}
          onPointerLeave={release}
          onPointerCancel={release}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) start();
          }}
          onKeyUp={release}
        >
          <span className="ab-hold-fill" style={{ width: `${held * 100}%` }} aria-hidden="true" />
          <span className="ab-hold-label">
            {prestige.ready
              ? `Hold to open ${site?.name ?? "a new workshop"}`
              : "Not ready yet"}
          </span>
        </button>
      </div>
    </section>
  );
}
