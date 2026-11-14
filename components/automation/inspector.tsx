import type { MachineDetail, NumberFormat, ResourceView } from "@/lib/automation/types";
import { fmtNum, resourceName } from "./format";
import { ArtDivider, ArtGauge, ArtPanel, MachinePortrait, PanelTitle, rarityOf } from "@/components/brasswork-art";

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

/** Machine inspector: portrait, status with its reason, what it makes, recipe choices, progress and build. */
export function Inspector({
  detail,
  resources,
  numberFormat,
  canBuild,
  onBuild,
  onSetRecipe,
  onClose,
}: {
  detail: MachineDetail | null;
  resources: ResourceView[];
  numberFormat: NumberFormat;
  canBuild: boolean;
  onBuild: (id: string) => void;
  onSetRecipe?: (recipeId: string) => void;
  onClose: () => void;
}) {
  if (!detail) {
    return (
      <ArtPanel className="ab-inspect ab-inspect-empty">
        <PanelTitle>Machine</PanelTitle>
        <p className="ab-dim">Tap Details on a machine to see what it does and what it makes.</p>
      </ArtPanel>
    );
  }

  const hasRecipe = detail.recipe.name !== "No recipe";
  const lineText = (lines: MachineDetail["recipe"]["inputs"]) =>
    lines.map((l) => `${fmtNum(l.amount, numberFormat)} ${resourceName(resources, l.resourceId)}`).join(", ");
  const status = STATUS_TEXT[detail.status] ?? detail.status;
  const options = detail.recipeOptions ?? [];
  const rate = detail.rates[0];

  return (
    <ArtPanel rarity={rarityOf(detail.id)} className="ab-inspect">
      <header className="ab-inspect-head">
        <MachinePortrait id={detail.id} size={96} label={detail.name} />
        <div className="ab-inspect-title">
          <PanelTitle>{detail.name}</PanelTitle>
          <span className="ab-dim">Owned {detail.count}</span>
        </div>
        <button type="button" className="ab-text-btn" onClick={onClose} aria-label="Close details">
          Close
        </button>
      </header>

      <p className="ab-inspect-status" data-status={detail.status}>{status}</p>

      {hasRecipe ? (
        <div className="ab-inspect-flow" aria-label="Makes">
          <span className="ab-inspect-in">{lineText(detail.recipe.inputs) || "Nothing"}</span>
          <span className="ab-arrow" aria-hidden="true">→</span>
          <span className="ab-inspect-out">{lineText(detail.recipe.outputs) || "Nothing"}</span>
          {detail.recipe.seconds > 0 && (
            <span className="ab-dim">{detail.recipe.seconds} s per batch</span>
          )}
        </div>
      ) : (
        <p className="ab-inspect-hint">{EXTRACTOR_TEXT[detail.id] ?? "Pick a recipe below to start it."}</p>
      )}

      {onSetRecipe && options.length > 1 && (
        <>
          <ArtDivider />
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
        </>
      )}

      {rate && (
        <>
          <ArtDivider />
          <div className="ab-inspect-rate">
            <span className="ab-dim">{rate.label}</span>
            <strong>{rate.value}</strong>
          </div>
        </>
      )}

      {detail.buffers.length > 0 && (
        <ul className="ab-buffers" aria-label="Buffers">
          {detail.buffers.map((b) => {
            const pct = b.max > 0 ? Math.min(1, b.have / b.max) : 0;
            return (
              <li key={b.resourceId} className="ab-buffer">
                <ArtGauge value={pct} size={40} label={`${resourceName(resources, b.resourceId)} buffer`} />
                <span className="ab-buffer-name">{resourceName(resources, b.resourceId)}</span>
                <span className="ab-buffer-val">
                  {fmtNum(b.have, numberFormat)} / {fmtNum(b.max, numberFormat)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="ab-action" disabled={!canBuild} onClick={() => onBuild(detail.id)}>
        Build another
      </button>
    </ArtPanel>
  );
}
