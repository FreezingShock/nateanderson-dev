import type { Line, MachineDetail, NumberFormat, RecipeEntry, ResourceView } from "@/lib/automation/types";
import { fmtNum, resourceName } from "./format";
import { ArtGauge, MachinePortrait } from "@/components/brasswork-art";
import { ArtIcon } from "@/components/brasswork-art/icons";
import "./inspector.css";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { recipeTip, stackText, type TipData } from "@/lib/automation/tips";
import { RECIPE_TREE } from "@/lib/automation/data/tree";

// Tag for one recipe in the picker. A locked recipe also says why it is shut.
function recipeOf(id: string, lockReason?: string): TipData | null {
  const r = RECIPE_TREE.recipes.find((x) => x.id === id);
  if (!r) return null;
  const tip = recipeTip(RECIPE_TREE, r);
  return lockReason ? { ...tip, rows: [...(tip.rows ?? []), { k: "Locked", v: lockReason, tone: "bad" as const }] } : tip;
}

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

/** Item icons with their amounts: "2 Iron ore + 1 Coal". Each icon names itself on hover. */
function Chips({ lines, resources, numberFormat, size }: { lines: Line[]; resources: ResourceView[]; numberFormat: NumberFormat; size: number }) {
  if (lines.length === 0) return <span className="ab-dim">Nothing</span>;
  return (
    <span className="ab-rc-chips">
      {lines.map((l, i) => (
        <span key={`${l.resourceId}-${i}`} className="ab-rc-chip">
          <ArtIcon id={l.resourceId} size={size} name={resourceName(resources, l.resourceId)} />
          <span className="ab-rc-amt">{fmtNum(l.amount, numberFormat)}</span>
        </span>
      ))}
    </span>
  );
}

/** One recipe in the picker: the real output icon, inputs and output with amounts, the rate, and the current pick. */
function RecipeRow({
  entry,
  resources,
  numberFormat,
  onPick,
}: {
  entry: RecipeEntry;
  resources: ResourceView[];
  numberFormat: NumberFormat;
  onPick?: (id: string) => void;
}) {
  const out = entry.outputs[0];
  const locked = entry.state === "locked";
  const selected = entry.state === "selected";
  const body = (
    <>
      <span className="ab-rc-out">
        {out && <ArtIcon id={out.resourceId} size={40} name={resourceName(resources, out.resourceId)} />}
      </span>
      <span className="ab-rc-body">
        <span className="ab-rc-name">
          {out ? resourceName(resources, out.resourceId) : entry.name}
          {entry.alternate && <span className="ab-rc-alt">Alternate</span>}
        </span>
        {locked ? (
          <span className="ab-rc-lock">{entry.lockReason ?? "Locked"}</span>
        ) : (
          <span className="ab-rc-flow" aria-label="Recipe">
            <Chips lines={entry.inputs} resources={resources} numberFormat={numberFormat} size={18} />
            <span className="ab-rc-arrow" aria-hidden="true">→</span>
            <Chips lines={entry.outputs} resources={resources} numberFormat={numberFormat} size={18} />
          </span>
        )}
      </span>
      <span className="ab-rc-meta">
        {!locked && entry.perMin > 0 && <strong className="ab-rc-rate">{fmtNum(entry.perMin, numberFormat)} /min</strong>}
        {!locked && entry.seconds > 0 && <span className="ab-dim">{entry.seconds} s a craft</span>}
        <span className="ab-rc-state">{selected ? "Selected" : locked ? "Locked" : "Use"}</span>
      </span>
    </>
  );
  const tip = tipAttr(recipeOf(entry.id, locked ? entry.lockReason : undefined));
  if (locked || !onPick) {
    return (
      <div className="ab-rc" data-state={entry.state} aria-disabled="true" {...tip}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="ab-rc"
      data-state={entry.state}
      aria-pressed={selected}
      {...tip}
      aria-label={`${out ? resourceName(resources, out.resourceId) : entry.name}${entry.alternate ? ", alternate" : ""}${selected ? ", selected" : ""}`}
      onClick={() => onPick(entry.id)}
    >
      {body}
    </button>
  );
}

/**
 * Machine inspector, drawn as one compact card: portrait and name, status, energy at a glance, what it makes,
 * the recipe picker, buffers and the build button. The floating frame is the caller's (the HUD's factory panel).
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
  // The simulation names an unset crafter "No recipe chosen"; older mocks say "No recipe". Both mean nothing is set.
  const noRecipe = detail.recipe.name === "No recipe" || detail.recipe.name === "No recipe chosen";
  const hasRecipe = !noRecipe;
  // Every recipe this building type runs, open and locked. Previews of an unplaced machine only have the open choices.
  const library: RecipeEntry[] = detail.recipeLibrary
    ?? (detail.recipeChoices ?? []).map((c) => ({
      id: c.id, name: c.name, alternate: c.alternate, inputs: c.inputs, outputs: c.outputs, seconds: c.seconds,
      perMin: c.seconds > 0 ? (c.outputs[0]?.amount ?? 0) * 60 / c.seconds : 0, state: "open" as const,
    }));
  const crafter = library.length > 0;
  const openCount = library.filter((e) => e.state !== "locked").length;
  const lockedCount = library.length - openCount;
  // A crafter with no recipe set is the case the player most often misses: say so plainly, then offer the picker.
  const needsRecipe = noRecipe && !detail.mines?.length && openCount > 0;
  const status = needsRecipe ? "No recipe set. This machine is not running." : (STATUS_TEXT[detail.status] ?? detail.status);
  const rate = detail.rates[0];
  const pickable = !!onSetRecipe && crafter && library.length > 1;
  // Selected first, then open, then locked (the sim orders open ones first; the selected one is marked in place).
  const ordered = library.filter((e) => e.state !== "locked");
  const shut = library.filter((e) => e.state === "locked");

  // Energy: a generator shows what it makes against its best; a consumer shows what it draws and how well it is fed.
  const generating = detail.maxKw !== undefined;
  const drawing = !generating && detail.usedKw !== undefined && detail.usedKw > 0;
  const energyFill = generating
    ? (detail.maxKw ? Math.min(1, (detail.producedKw ?? 0) / detail.maxKw) : 0)
    : Math.min(1, detail.satisfied ?? 0);
  const energyState = generating ? "source" : detail.fullyPowered ? "full" : "short";
  const current = detail.recipeId ? library.find((e) => e.id === detail.recipeId) : undefined;

  return (
    <div className="ab-inspect" data-status={detail.status} data-norecipe={needsRecipe ? "true" : undefined}>
      <header className="ab-inspect-head">
        <span className="ab-inspect-art">
          <MachinePortrait id={detail.id} size={64} label={detail.name} />
        </span>
        <div className="ab-inspect-title">
          <h2 className="ab-inspect-name">{detail.name}</h2>
          <span className="ab-inspect-owned">Owned {detail.count}</span>
        </div>
        <button type="button" className="ab-inspect-close" onClick={onClose} aria-label="Close details" {...tipAttr({ title: "Close details", tag: "Inspector", text: "Put the card away. The building stays where it is." })}>
          ×
        </button>
      </header>

      <p className="ab-inspect-status" data-status={needsRecipe ? "norecipe" : detail.status}>{status}</p>
      {detail.reason && !needsRecipe && <p className="ab-inspect-hint">{detail.reason}</p>}

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
              <ArtIcon id={m.resourceId} size={28} name={m.name} />
              <span>{m.name}</span>
              <span className="ab-dim">{m.purity}</span>
              <strong>{fmtNum(m.perMin, numberFormat)} / min</strong>
            </li>
          ))}
        </ul>
      ) : hasRecipe && current ? (
        <div className="ab-inspect-making" aria-label="Makes">
          <span className="ab-dim">Making</span>
          <Chips lines={current.inputs} resources={resources} numberFormat={numberFormat} size={20} />
          <span className="ab-rc-arrow" aria-hidden="true">→</span>
          <Chips lines={current.outputs} resources={resources} numberFormat={numberFormat} size={20} />
          {current.seconds > 0 && <span className="ab-dim">{current.seconds} s a craft</span>}
        </div>
      ) : hasRecipe ? (
        <div className="ab-inspect-making" aria-label="Makes">
          <span className="ab-dim">Making</span>
          <Chips lines={detail.recipe.inputs} resources={resources} numberFormat={numberFormat} size={20} />
          <span className="ab-rc-arrow" aria-hidden="true">→</span>
          <Chips lines={detail.recipe.outputs} resources={resources} numberFormat={numberFormat} size={20} />
          {detail.recipe.seconds > 0 && <span className="ab-dim">{detail.recipe.seconds} s a craft</span>}
        </div>
      ) : needsRecipe ? (
        <p className="ab-inspect-callout" role="status">
          <strong>No recipe set.</strong> Pick one below and this machine starts working.
        </p>
      ) : (
        <p className="ab-inspect-hint">{EXTRACTOR_TEXT[detail.id] ?? "Pick a recipe below to start it."}</p>
      )}

      {rate && (
        <div className="ab-inspect-rate">
          <span className="ab-dim">{rate.label}</span>
          <strong>{rate.value}</strong>
        </div>
      )}

      {crafter && (
        <section className="ab-picker" aria-label="Recipes">
          <div className="ab-picker-head">
            <span>Recipes</span>
            <span className="ab-dim">
              {openCount} open{lockedCount > 0 ? `, ${lockedCount} locked` : ""}
            </span>
          </div>
          {pickable ? (
            <div role="group" aria-label="Choose a recipe" className="ab-picker-list">
              {ordered.map((e) => (
                <RecipeRow key={e.id} entry={e} resources={resources} numberFormat={numberFormat} onPick={onSetRecipe} />
              ))}
              {shut.length > 0 && <p className="ab-picker-sub">Locked</p>}
              {shut.map((e) => (
                <RecipeRow key={e.id} entry={e} resources={resources} numberFormat={numberFormat} />
              ))}
            </div>
          ) : (
            <p className="ab-dim ab-picker-only">Only one recipe runs here.</p>
          )}
        </section>
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

      <button type="button" className="ab-inspect-build" disabled={!canBuild} {...tipAttr({ title: `Build one more ${detail.name}`, tag: "Build", rows: [{ k: "Cost", v: detail.cost.length ? stackText(RECIPE_TREE, detail.cost) : "Free" }, ...(canBuild ? [] : [{ k: "Status", v: "Not enough resources", tone: "bad" as const }])] })} onClick={() => onBuild(detail.id)}>
        Build another
      </button>
    </div>
  );
}
