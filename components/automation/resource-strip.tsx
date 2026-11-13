import type { ResourceView, NumberFormat } from "@/lib/automation/types";
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
    return (
      <span
        className="ab-glyph ab-glyph-art"
        style={iconStyle(icon, size)}
        aria-hidden="true"
      />
    );
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
      {items.map((r) => (
        <li key={r.id} className="ab-res-item" data-empty={r.amount <= 0}>
          <Glyph code={r.glyph} size={28} icon={r.id} />
          <span className="ab-res-name">{r.name}</span>
          <span className="ab-res-amt">{fmtNum(r.amount, numberFormat)}</span>
          {showRates && (
            <span className="ab-res-rate" data-neg={r.perSecond < 0}>
              {fmtRate(r.perSecond, numberFormat)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
