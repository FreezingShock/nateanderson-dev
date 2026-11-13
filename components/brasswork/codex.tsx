"use client";

// The machine codex: every machine in the recipe tree with its size, power, build cost and what it makes.
// Reads the same catalog the sim uses, so it never drifts from the numbers in play.
import { DEFAULT_CATALOG } from "@/lib/automation/sim";
import type { Stack } from "@/lib/automation/types";

const tree = DEFAULT_CATALOG.tree;
const itemName = new Map(tree.items.map((i) => [i.id, i.name]));
const nm = (id: string) => itemName.get(id) ?? id.replace(/_/g, " ");
const stacks = (s: Stack[]) => s.map((x) => `${x.qty} ${nm(x.item)}`).join(", ");

export function Codex({ onClose }: { onClose: () => void }) {
    return (
        <div className="bx-scrim" onClick={onClose}>
            <div className="bx-card bx-wide" role="dialog" aria-label="Machine codex" onClick={(e) => e.stopPropagation()}>
                <h2 className="bw-title">Codex</h2>
                {tree.machines.map((m) => {
                    const made = tree.recipes.filter((r) => r.machine === m.id && !r.alternate);
                    const alts = tree.recipes.filter((r) => r.machine === m.id && r.alternate);
                    return (
                        <section key={m.id} className="bx-entry">
                            <h3 className="bx-h bx-name">{m.name}</h3>
                            <div className="bw-row">
                                <span>Size</span>
                                <span className="bx-key">
                                    {m.footprint.w} x {m.footprint.d}
                                </span>
                            </div>
                            <div className="bw-row">
                                <span>Opens at</span>
                                <span className="bx-key">stage {m.unlockStage}</span>
                            </div>
                            {m.powerKw > 0 && (
                                <div className="bw-row">
                                    <span>Draws</span>
                                    <span className="bx-key">{m.powerKw} kW</span>
                                </div>
                            )}
                            {m.generatesKw ? (
                                <div className="bw-row">
                                    <span>Makes power</span>
                                    <span className="bx-key">{m.generatesKw} kW</span>
                                </div>
                            ) : null}
                            {m.buildCost?.length ? (
                                <div className="bw-row">
                                    <span>Costs</span>
                                    <span className="bx-key bx-r">{stacks(m.buildCost)}</span>
                                </div>
                            ) : null}
                            {m.note && <p className="bx-note">{m.note}</p>}
                            {[...made, ...alts].map((r) => (
                                <div className="bx-recipe" key={r.id}>
                                    <span>
                                        {stacks(r.inputs)} <span className="bx-arrow">to</span> {stacks([r.output])}
                                    </span>
                                    <span className="bx-key">
                                        {r.craftSeconds}s{r.alternate ? " · alternate" : ""}
                                    </span>
                                </div>
                            ))}
                        </section>
                    );
                })}
                <button type="button" className="bw-btn" onClick={onClose}>
                    Close
                </button>
            </div>
        </div>
    );
}
