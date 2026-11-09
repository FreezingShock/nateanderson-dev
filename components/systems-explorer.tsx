"use client";

import { memo, useCallback, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ABOUT_ICONS } from "@/components/about-icons";
import { Collapse } from "@/components/collapse";
import { CountUp } from "@/components/cm/reveal";
import { cn } from "@/lib/utils";
import { gameFacts, gameSystems, type GameSystem } from "@/lib/about-data";

// Fractured Islands' architecture: the headline numbers, then the four interlocking systems, each
// opening to its parts. (Fractured Islands is the Roblox game; the old web idle spin-off is gone.)

const SystemCard = memo(function SystemCard({
    system,
    open,
    onToggle,
}: {
    system: GameSystem;
    open: boolean;
    onToggle: (id: string) => void;
}) {
    const Icon = ABOUT_ICONS[system.icon];
    const panelId = `${system.id}-parts`;

    return (
        <div className={cn("cm-card", open && "on")} style={{ padding: 0 }}>
            <button
                type="button"
                onClick={() => onToggle(system.id)}
                aria-expanded={open}
                aria-controls={panelId}
                className="cm-row"
                style={{ width: "100%", alignItems: "flex-start", flexWrap: "nowrap", gap: 12, padding: 14, background: "transparent", border: 0, color: "inherit", textAlign: "left", cursor: "pointer", font: "inherit" }}
            >
                <Icon className="cm-ico" style={{ width: 22, height: 22, marginTop: 2 }} aria-hidden="true" />
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
                    <span className="cm-row" style={{ gap: 8 }}>
                        <b style={{ fontSize: 16 }}>{system.name}</b>
                        {system.priority && <span className="cm-tag flat">Build #{system.priority}</span>}
                    </span>
                    <span className="cm-note">{system.description}</span>
                </span>
                <ChevronDown className={cn("cm-ico transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
            </button>
            <Collapse open={open} id={panelId}>
                <ul style={{ margin: "0 14px 14px", padding: "12px 0 0", borderTop: "1px solid var(--cm-hair)", display: "grid", gap: 10, listStyle: "none" }}>
                    {system.parts.map((part) => (
                        <li key={part.name} style={{ fontSize: 13 }}>
                            <b className="cm-lbl" style={{ color: "var(--cm-fg)" }}>{part.name}</b>
                            <span style={{ color: "var(--cm-mute)" }}> · {part.description}</span>
                        </li>
                    ))}
                </ul>
            </Collapse>
        </div>
    );
});

export function SystemsExplorer() {
    const [open, setOpen] = useState<Record<string, boolean>>({ menu: true });
    const toggle = useCallback((id: string) => setOpen((o) => ({ ...o, [id]: !o[id] })), []);

    return (
        <div style={{ display: "grid", gap: "var(--cm-s5)" }}>
            <dl className="cm-panel tick cm-kv" style={{ ["--cols" as string]: gameFacts.length }}>
                {gameFacts.map((f) => (
                    <div key={f.label}>
                        <dt>{f.label}</dt>
                        <dd style={{ fontSize: 26 }}>
                            <CountUp value={f.value} />
                            {f.suffix}
                        </dd>
                    </div>
                ))}
            </dl>

            <p className="cm-prose" style={{ margin: 0 }}>
                <strong>Fractured Islands: Ascension</strong> is a solo-built Roblox progression game. Its architecture
                separates concerns across four interconnected systems, each modular and testable on its own. Open any one
                to see its parts.
            </p>

            <div className="cm-grid" style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
                {gameSystems.map((system) => (
                    <SystemCard key={system.id} system={system} open={!!open[system.id]} onToggle={toggle} />
                ))}
            </div>

            <Link href="/creations/fractured-islands" className="cm-more" style={{ justifySelf: "start" }}>
                See the full project →
            </Link>
        </div>
    );
}
