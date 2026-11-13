import type { MachineDetail, NumberFormat, ResourceView } from "./types";
import { fmtNum, resourceName } from "./format";

/** Machine inspector: recipe, rates and buffers for the selected machine. */
export function Inspector({
  detail,
  resources,
  numberFormat,
  canBuild,
  onBuild,
  onClose,
}: {
  detail: MachineDetail | null;
  resources: ResourceView[];
  numberFormat: NumberFormat;
  canBuild: boolean;
  onBuild: (id: string) => void;
  onClose: () => void;
}) {
  if (!detail) {
    return (
      <section className="ab-panel ab-inspect" aria-label="Machine inspector">
        <h2 className="ab-h">Inspector</h2>
        <p className="ab-dim">Press Info on a machine to see its recipe, rates and buffers.</p>
      </section>
    );
  }

  const flow = (lines: MachineDetail["recipe"]["inputs"]) =>
    lines.length === 0
      ? "nothing"
      : lines
          .map((l) => `${fmtNum(l.amount, numberFormat)} ${resourceName(resources, l.resourceId)}`)
          .join(" + ");

  return (
    <section className="ab-panel ab-inspect" aria-label="Machine inspector">
      <header className="ab-head">
        <h2 className="ab-h">{detail.name}</h2>
        <button type="button" className="ab-text-btn" onClick={onClose}>
          Close
        </button>
      </header>

      <dl className="ab-data">
        <div>
          <dt>Status</dt>
          <dd data-status={detail.status}>{detail.status}</dd>
        </div>
        <div>
          <dt>Owned</dt>
          <dd>{detail.count}</dd>
        </div>
        <div>
          <dt>Recipe</dt>
          <dd>{detail.recipe.name}</dd>
        </div>
        <div>
          <dt>Takes</dt>
          <dd>{detail.recipe.seconds} s</dd>
        </div>
      </dl>

      <p className="ab-flow">
        <span>{flow(detail.recipe.inputs)}</span>
        <span className="ab-arrow" aria-hidden="true">
          →
        </span>
        <span>{flow(detail.recipe.outputs)}</span>
      </p>

      <dl className="ab-data">
        {detail.rates.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="ab-buffers" aria-label="Buffers">
        {detail.buffers.map((b) => {
          const pct = b.max > 0 ? Math.min(100, (b.have / b.max) * 100) : 0;
          return (
            <li key={b.resourceId} className="ab-buffer">
              <span className="ab-buffer-name">{resourceName(resources, b.resourceId)}</span>
              <span
                className="ab-bar"
                role="meter"
                aria-label={`${resourceName(resources, b.resourceId)} buffer`}
                aria-valuemin={0}
                aria-valuemax={b.max}
                aria-valuenow={b.have}
              >
                <span className="ab-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="ab-buffer-val">
                {fmtNum(b.have, numberFormat)} / {fmtNum(b.max, numberFormat)}
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="ab-action"
        disabled={!canBuild}
        onClick={() => onBuild(detail.id)}
      >
        Build one more
      </button>
    </section>
  );
}
