import { useEffect, useRef, useState } from "react";
import type { ResourceView, NumberFormat } from "@/lib/automation/types";
import { ArtIcon } from "@/components/brasswork-art/icons";
import { fmtNum, fmtRate } from "./format";
import "./resource-box.css";
import { iconCell, iconStyle } from "@/lib/automation/icons";
import { tipAttr, type TipData } from "@/components/brasswork-ui/tip";
import { itemTip } from "@/lib/automation/tips";
import { DEFAULT_CATALOG } from "@/lib/automation/sim/data";

/**
 * A square badge for an item or machine. Shows the sprite-sheet icon when the id has one
 * (items, machines), otherwise the two-letter code.
 */
export function Glyph({
  code,
  size = 32,
  icon,
}: {
  code: string;
  size?: number;
  icon?: string;
}) {
  if (icon && iconCell(icon) !== undefined) {
    return <ArtIcon id={icon} size={size} className="ab-glyph ab-glyph-art" />;
  }
  return (
    <span
      className="ab-glyph"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.34)),
      }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}

/**
 * Strip ids that are not catalogue item ids, mapped to the item whose icon they should show. The catalogue
 * (lib/automation/data/tree.ts) uses the ids on the left of the arrow only where a preview or mock feed does, so
 * every resource on the bar gets its real item icon. Clockworks has no drawn icon yet, so it keeps its text badge.
 */

/** The top-bar tag for one resource: live stock and trend, plus what it is and how it is made (from the recipe tree). */
function resourceTip(
  r: ResourceView,
  amount: string,
  rate: string,
  showRates: boolean,
  emptyNote: string | null,
): TipData {
  const base = itemTip(DEFAULT_CATALOG.tree, r.id);
  const rows: NonNullable<TipData["rows"]> = [{ k: "In stock", v: amount }];
  if (showRates) {
    const word = r.perSecond > 0 ? "Rising" : r.perSecond < 0 ? "Falling" : "Steady";
    rows.push({ k: "Per second", v: rate, tone: r.perSecond < 0 ? "bad" : r.perSecond > 0 ? "good" : undefined });
    rows.push({ k: "Trend", v: word });
  }
  return {
    title: r.name,
    tag: base.tag,
    text: base.text,
    rows: [...rows, ...(base.rows ?? [])],
    note: emptyNote ?? undefined,
  };
}

export function ResourceStrip({
  resources,
  showRates,
  numberFormat,
}: {
  resources: ResourceView[];
  showRates: boolean;
  numberFormat: NumberFormat;
}) {
  const raw = resources.filter((r) => r.group === "raw");
  const parts = resources.filter((r) => r.group === "part");

  return (
    <div className="ab-res" aria-label="Resources">
      <ResourceList
        label="Raw"
        items={raw}
        showRates={showRates}
        numberFormat={numberFormat}
      />
      <ResourceList
        label="Parts"
        items={parts}
        showRates={showRates}
        numberFormat={numberFormat}
      />
    </div>
  );
}

/**
 * A "+N" that floats up off a resource box when its stock rises. It fires at most about once a second per resource, so a
 * busy belt reads as a steady tick, not a flicker. Gains only; a fall shows nothing. Hidden under reduced motion or Low fx.
 */
function GainFloat({ amount, numberFormat }: { amount: number; numberFormat: NumberFormat }) {
  const prev = useRef(amount);
  const last = useRef(0);
  const [pop, setPop] = useState<{ key: number; text: string } | null>(null);
  useEffect(() => {
    const d = amount - prev.current;
    prev.current = amount;
    if (d <= 0) return;
    const now = performance.now();
    if (now - last.current < 900) return;
    last.current = now;
    setPop({ key: now, text: `+${fmtNum(d, numberFormat)}` });
  }, [amount, numberFormat]);
  if (!pop) return null;
  return (
    <span key={pop.key} className="ab-res-gain" aria-hidden="true">
      {pop.text}
    </span>
  );
}

function ResourceList({
  label,
  items,
  showRates,
  numberFormat,
}: {
  label: string;
  items: ResourceView[];
  showRates: boolean;
  numberFormat: NumberFormat;
}) {
  return (
    <ul className="ab-res-list" aria-label={label}>
      {items.map((r) => {
        const amount = fmtNum(r.amount, numberFormat);
        const rate = fmtRate(r.perSecond, numberFormat);
        // A negative rate means the factory uses this faster than it arrives. Say that in words, not only with a sign.
        const trend =
          r.perSecond > 0
            ? "Rising, more arrives than is used"
            : r.perSecond < 0
              ? "Falling, used faster than it arrives"
              : "Steady";
        const emptyNote =
          r.amount <= 0 && r.perSecond < 0
            ? "None left and falling. Machines that use it are waiting. Mine or craft more."
            : r.amount <= 0
              ? "None left. Mine or craft more."
              : null;
        return (
          <li
            key={r.id}
            className="ab-res-item"
            data-empty={r.amount <= 0}
            // Focusable so the tooltip also shows from the keyboard. The name lives in the tooltip, not on the bar.
            tabIndex={0}
            aria-label={`${r.name}, ${amount}${showRates ? `, ${rate}` : ""}`}
            {...tipAttr(resourceTip(r, amount, rate, showRates, emptyNote))}
          >
            <span className="ab-res-box">
              <Glyph code={r.glyph} size={48} icon={r.id} />
              <span className="ab-res-amt">{amount}</span>
              <GainFloat amount={r.amount} numberFormat={numberFormat} />
            </span>
            {/* The rate sits under its box. A steady item keeps an empty slot, so every box has the same height. */}
            {showRates && (
              <span className="ab-res-rate" data-neg={r.perSecond < 0} aria-hidden="true">
                {r.perSecond !== 0 ? rate : ""}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
