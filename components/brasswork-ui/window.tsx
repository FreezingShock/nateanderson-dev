"use client";

import { useEffect, type ReactNode } from "react";
import "./window.css";
import "./scrollbar.css";

export type MenuWindowProps = {
  /** Title text, shown in capitals in the header. */
  title: string;
  /** Optional art shown before the title. Pass a 32px element; it is clipped to the slot. */
  art?: ReactNode;
  /** Called on Close, Escape, or a click on the blank area around the window. */
  onClose: () => void;
  /** Accessible name for the dialog. Defaults to the title. */
  label?: string;
  children: ReactNode;
};

/**
 * Centred menu window for Brasswork. Closes on Escape, the Close button, or a click on the blank area
 * around it. The close button sits in its own column, so it never overlaps the title.
 * Only one window should be open at a time: the caller holds the open state and renders one at a time.
 */
export function MenuWindow({ title, art, onClose, label, children }: MenuWindowProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="bw-window-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="bw-window bw" role="dialog" aria-modal="true" aria-label={label ?? title}>
        <header className="bw-window-head">
          <span className="bw-window-art" aria-hidden={art ? undefined : true}>{art}</span>
          <h2 className="bw-window-title">{title}</h2>
          <button type="button" className="bw-window-close" onClick={onClose}>Close</button>
        </header>
        <div className="bw-window-body">{children}</div>
      </section>
    </div>
  );
}
