"use client";

import { BRANCHES, TREE, hasNode, nodeOpen, type State } from "@/lib/nodefarm/engine";

/** The prestige tree: three branches of six upgrades, bought with AP and kept through every Ascend. */
export function TreePanel({ s, onNode }: { s: State; onNode: (id: string) => void }) {
    return (
        <section className="nf-tree-wrap">
            <header className="nf-sys-h">
                <h3>Prestige tree</h3>
                <p>{s.ap} AP to spend. Each node needs the one before it. Nothing here resets.</p>
            </header>
            <div className="nf-tree">
                {BRANCHES.map((b) => {
                    const nodes = TREE.filter((n) => n.branch === b.id);
                    const owned = nodes.filter((n) => hasNode(s, n.id)).length;
                    return (
                        <section key={b.id} className="nf-branch" style={{ ["--c" as string]: b.color }} aria-label={`${b.name} branch`}>
                            <header>
                                <b>{b.name}</b>
                                <small>{owned}/{nodes.length}</small>
                            </header>
                            <p>{b.blurb}</p>
                            <ol>
                                {nodes.map((n) => {
                                    const have = hasNode(s, n.id);
                                    const open = nodeOpen(s, n);
                                    return (
                                        <li key={n.id} data-state={have ? "owned" : open ? "open" : "locked"}>
                                            <span className="nf-node-t">
                                                <b>{n.name}</b>
                                                <small>{n.blurb}</small>
                                            </span>
                                            <button type="button" className="nf-mini" disabled={have || !open || s.ap < n.cost} onClick={() => onNode(n.id)}>
                                                {have ? "Owned" : !open ? "Locked" : `${n.cost} AP`}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                    );
                })}
            </div>
        </section>
    );
}
