"use client";

/*
 * MenuWindow: the shared Brasswork menu window.
 *
 * Behaviour
 * - No dark scrim. The game stays visible and keeps running behind the window. The layer behind the window is
 *   transparent and only catches a click on the blank area, which closes the window.
 * - Closes on Escape, the Close button, or a blank-area click. Closing plays the exit animation first (160 ms), then calls onClose, so the caller's open state changes after the window has gone.
 * - Only one window should be open at a time. The caller holds the open state and renders one at a time.
 *
 * Variant (the `variant` prop, also written to data-variant on the window)
 * - "iris"   (default): brass iris opening from the centre. Use for full menus such as Research and Expedition.
 * - "shutter": a brass shutter sliding down from the top. Use for reports and lists such as Production stats.
 * - "settle": the window drops in from just above and settles. Use for small confirmations and Settings.
 *
 * Motion rules
 * - Enter 200 ms, exit 160 ms (motion.css tokens). Every shape uses transform and opacity only. Reduce motion (`data-reduce="true"` or the OS setting) and Simple visuals
 *   (`data-lowfx="true"`) both switch the animation off. Those attributes are read from the enclosing
 *   .ab-root or .bw-root, so the window needs no extra prop for them.
 */

import { useRef, type ReactNode } from "react";
import { useFocusTrap, useWindowClose } from "@/components/game-kit/use-window";
import "./motion.css";
import "./window.css";
import "./scrollbar.css";

export type MenuWindowVariant = "iris" | "shutter" | "settle";

/**
 * Which menu this window is. Each theme has its own header banner (public/brasswork/window/banner-<theme>.png, drawn by
 * scripts/brasswork/build-window-art.py) and its own open and close motion, which replaces the variant's:
 * research unrolls like a plan, expedition unfolds like a chart, production drops a shutter, settings settles with a
 * turning gear, hub opens like workshop doors, milestones lands like a stamp.
 */
export type MenuWindowTheme = "research" | "expedition" | "production" | "settings" | "hub" | "milestones";

export type MenuWindowProps = {
  /** Title text, shown in capitals in the header. */
  title: string;
  /** Optional art shown before the title. Pass a 32px element; it is clipped to the slot. */
  art?: ReactNode;
  /** Called after the exit animation on Close, Escape, or a click on the blank area around the window. */
  onClose: () => void;
  /** Accessible name for the dialog. Defaults to the title. */
  label?: string;
  /** "default" is 640px wide; "wide" is 960px; "xwide" is 1160px, for menus with a tree and a detail panel. Each is capped to the viewport. Phones use the full width. */
  size?: "default" | "wide" | "xwide";
  /** Open and close motion. See the variant notes at the top of this file. */
  variant?: MenuWindowVariant;
  /** Header banner art and open/close motion for this menu. See MenuWindowTheme. */
  theme?: MenuWindowTheme;
  children: ReactNode;
};

/** How long the exit animation runs before onClose fires. Keep in step with --bwm-exit in motion.css. */
const EXIT_MS = 160;

/**
 * Centred menu window for Brasswork. Closes on Escape, the Close button, or a click on the blank area
 * around it. The close button sits in its own column, so it never overlaps the title.
 * Only one window should be open at a time: the caller holds the open state and renders one at a time.
 */
export function MenuWindow({
  title,
  art,
  onClose,
  label,
  size = "default",
  variant = "iris",
  theme,
  children,
}: MenuWindowProps) {
  const box = useRef<HTMLElement>(null);
  // Exit animation then onClose, Escape to close, and a modal focus trap: the game kit's window hooks.
  const { closing, requestClose } = useWindowClose(onClose, { exitMs: EXIT_MS });
  useFocusTrap(box);

  return (
    <div
      className="bw-window-scrim"
      data-closing={closing ? "true" : undefined}
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
    >
      <section
        ref={box}
        tabIndex={-1}
        className="bw-window bw"
        data-size={size}
        data-variant={variant}
        data-theme={theme}
        data-closing={closing ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
      >
        <header className="bw-window-head">
          {theme ? <span className="bw-window-banner" aria-hidden="true" /> : null}
          <span className="bw-window-art" aria-hidden={art ? undefined : true}>{art}</span>
          <h2 className="bw-window-title">{title}</h2>
          <button type="button" className="bw-window-close" onClick={requestClose}>Close</button>
        </header>
        <div className="bw-window-body">{children}</div>
      </section>
    </div>
  );
}
