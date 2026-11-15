import type { ResourceView, NumberFormat } from "@/lib/automation/types";
import { ArtIcon } from "@/components/brasswork-art/icons";
import { fmtNum, fmtRate } from "./format";
import { iconCell, iconStyle } from "@/lib/automation/icons";

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
          >
            <Glyph code={r.glyph} size={48} icon={r.id} />
            <span className="ab-res-amt">{amount}</span>
            {showRates && r.perSecond !== 0 && (
              <span className="ab-res-rate" data-neg={r.perSecond < 0}>
                {rate}
              </span>
            )}
            {/* Live: the tooltip reads the same data as the bar, so it updates with the factory. */}
            <span className="ab-res-tip" aria-hidden="true">
              <strong className="ab-res-tip-name">{r.name}</strong>
              <span className="ab-res-tip-line">
                <span>In stock</span>
                <b>{amount}</b>
              </span>
              {showRates && (
                <span className="ab-res-tip-line">
                  <span>{trend}</span>
                  <b data-neg={r.perSecond < 0}>{rate}</b>
                </span>
              )}
              {emptyNote && <span className="ab-res-tip-note">{emptyNote}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
