import type { MachineDetail, NumberFormat, ResourceView } from "@/lib/automation/types";
import { fmtNum, resourceName } from "./format";
import { ArtGauge, MachinePortrait } from "@/components/brasswork-art";
import "./inspector.css";

// Plain reasons for each status, so the panel says what to do rather than only what is happening.
const STATUS_TEXT: Record<string, string> = {
  working: "Working. Output is flowing.",
  idle: "Idle. Nothing to work on right now.",
  blocked: "Blocked. Its output is full or its input has stopped.",
  starved: "Waiting. A required input has not arrived yet.",
  unpowered: "No power. Add a windmill or spring winder.",
};

// Drills and other extractors have no recipe in the data, so the panel says what they do.
const EXTRACTOR_TEXT: Record<string, string> = {
  drill: "Mines the ore under it. Place it on a resource node.",
};

/**
 * Machine inspector, drawn as one compact card: portrait and name, status, energy at a glance, what it makes,
 * then recipe choices, buffers and the build button. The floating frame is the caller's (the HUD's factory panel).
 */
export function Inspector({
  detail,
  resources,
  numberFormat,
  canBuild,
  onBuild,
  onSetRecipe,
  onClose,
}: {
  detail: MachineDetail;
  resources: ResourceView[];
  numberFormat: NumberFormat;
  canBuild: boolean;
  onBuild: (id: string) => void;
  onSetRecipe?: (recipeId: string) => void;
  onClose: () => void;
}) {
  const hasRecipe = detail.recipe.name !== "No recipe";
  const lineText = (lines: MachineDetail["recipe"]["inputs"]) =>
    lines.map((l) => `${fmtNum(l.amount, numberFormat)} ${resourceName(resources, l.resourceId)}`).join(", ");
  const status = STATUS_TEXT[detail.status] ?? detail.status;
  const options = detail.recipeOptions ?? [];
  const rate = detail.rates[0];

  // Energy: a generator shows what it makes against its best; a consumer shows what it draws and how well it is fed.
  const generating = detail.maxKw !== undefined;
  const drawing = !generating && detail.usedKw !== undefined && detail.usedKw > 0;
  const energyFill = generating
    ? (detail.maxKw ? Math.min(1, (detail.producedKw ?? 0) / detail.maxKw) : 0)
    : Math.min(1, detail.satisfied ?? 0);
  const energyState = generating ? "source" : detail.fullyPowered ? "full" : "short";

  return (
    <div className="ab-inspect" data-status={detail.status}>
      <header className="ab-inspect-head">
        <span className="ab-inspect-art">
          <MachinePortrait id={detail.id} size={64} label={detail.name} />
        </span>
        <div className="ab-inspect-title">
          <h2 className="ab-inspect-name">{detail.name}</h2>
          <span className="ab-inspect-owned">Owned {detail.count}</span>
        </div>
        <button type="button" className="ab-inspect-close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </header>

      <p className="ab-inspect-status" data-status={detail.status}>{status}</p>
      {detail.reason && <p className="ab-inspect-hint">{detail.reason}</p>}

      {(generating || drawing) && (
        <div className="ab-inspect-energy" data-state={energyState} aria-label={generating ? "Power output" : "Power use"}>
          <div className="ab-inspect-energy-row">
            <span className="ab-inspect-energy-k">{generating ? "Output" : "Power"}</span>
            <strong className="ab-inspect-energy-v">
              {generating
                ? `${fmtNum(detail.producedKw ?? 0, numberFormat)} / ${fmtNum(detail.maxKw ?? 0, numberFormat)} kW`
                : `${fmtNum(detail.usedKw ?? 0, numberFormat)} kW`}
            </strong>
          </div>
          <span className="ab-inspect-bar" role="img" aria-label={`${Math.round(energyFill * 100)} percent`}>
            <i style={{ width: `${Math.round(energyFill * 100)}%` }} />
          </span>
          <span className="ab-inspect-energy-note">
            {generating
              ? `${detail.windPct !== undefined ? `Wind ${Math.round(detail.windPct * 100)}% · ` : ""}feeds ${detail.fedCount ?? 0} within ${detail.rangeCells ?? 0} cells`
              : detail.fullyPowered
                ? "Fully powered"
                : `${Math.round((detail.satisfied ?? 0) * 100)}% of what it needs`}
          </span>
        </div>
      )}

      {detail.mines && detail.mines.length > 0 ? (
        <ul className="ab-inspect-mines" aria-label="Mines">
          {detail.mines.map((m) => (
            <li key={m.resourceId} className="ab-inspect-mine">
              <span>{m.name}</span>
              <span className="ab-dim">{m.purity}</span>
              <strong>{fmtNum(m.perMin, numberFormat)} / min</strong>
            </li>
          ))}
        </ul>
      ) : hasRecipe ? (
        <div className="ab-inspect-flow" aria-label="Makes">
          <span className="ab-inspect-in">{lineText(detail.recipe.inputs) || "Nothing"}</span>
          <span className="ab-arrow" aria-hidden="true">→</span>
          <span className="ab-inspect-out">{lineText(detail.recipe.outputs) || "Nothing"}</span>
          {detail.recipe.seconds > 0 && <span className="ab-dim">{detail.recipe.seconds} s per batch</span>}
        </div>
      ) : (
        <p className="ab-inspect-hint">{EXTRACTOR_TEXT[detail.id] ?? "Pick a recipe below to start it."}</p>
      )}

      {rate && (
        <div className="ab-inspect-rate">
          <span className="ab-dim">{rate.label}</span>
          <strong>{rate.value}</strong>
        </div>
      )}

      {onSetRecipe && options.length > 1 && (
        <div role="group" aria-label="Recipe" className="ab-inspect-recipes">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="ab-recipe-row"
              aria-pressed={o.id === detail.recipeId}
              data-selected={o.id === detail.recipeId}
              onClick={() => onSetRecipe(o.id)}
            >
              <span className="ab-recipe-name">
                {o.name}
                {o.alternate ? <span className="ab-dim"> · alternate</span> : null}
              </span>
              <span className="ab-recipe-state">{o.id === detail.recipeId ? "Selected" : "Use"}</span>
            </button>
          ))}
        </div>
      )}

      {detail.buffers.length > 0 && (
        <ul className="ab-buffers" aria-label="Buffers">
          {detail.buffers.map((b) => {
            const pct = b.max > 0 ? Math.min(1, b.have / b.max) : 0;
            return (
              <li key={b.resourceId} className="ab-buffer">
                <ArtGauge value={pct} size={32} label={`${resourceName(resources, b.resourceId)} buffer`} />
                <span className="ab-buffer-name">{resourceName(resources, b.resourceId)}</span>
                <span className="ab-buffer-val">
                  {fmtNum(b.have, numberFormat)} / {fmtNum(b.max, numberFormat)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="ab-inspect-build" disabled={!canBuild} onClick={() => onBuild(detail.id)}>
        Build another
      </button>
    </div>
  );
}
