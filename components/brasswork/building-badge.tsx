"use client";

// "BUILDING" badge: shown while any build tool is armed, so it is always clear that a click will place something.
// Shows the real menu art icon of the armed item, its name and the current turn. Esc (or arming nothing) hides it.
// Sits just under the top bar at the stage's centre, clear of the bottom hint bar and objective card. Ignores clicks.
import { useEffect, useState } from "react";
import type { InputController } from "@/lib/automation/input";
import { DELETE_TOOL } from "@/lib/automation/input/build";
import { ArtIcon, UiArtIcon } from "@/components/brasswork-art/icons";
import "./building-badge.css";

export function BuildingBadge({ input, nameOf }: { input: InputController; nameOf: (kind: string) => string }) {
    const [state, setState] = useState<{ id: string; rot: number } | null>(null);
    useEffect(() => {
        const build = input.build;
        const sync = () => {
            const t = build.getTool();
            const rot = build.getRot() * 90;
            setState((prev) => {
                if (!t) return prev === null ? prev : null;
                return prev && prev.id === t.id && prev.rot === rot ? prev : { id: t.id, rot };
            });
        };
        sync();
        return build.subscribe(sync);
    }, [input]);
    if (!state) return null;
    const removing = state.id === DELETE_TOOL.id;
    return (
        <div className="bw-building" key={state.id} data-mode={removing ? "remove" : "build"} role="status" aria-live="polite">
            <span className="bw-building-art">{removing ? <UiArtIcon id="remove" size={36} /> : <ArtIcon id={state.id} size={40} />}</span>
            <span className="bw-building-text">
                <span className="bw-building-k">{removing ? "REMOVING" : "BUILDING"}</span>
                <span className="bw-building-v">{removing ? "Remove" : nameOf(state.id)}</span>
            </span>
            {!removing && (
                <span className="bw-building-rot" aria-label={`Turned ${state.rot} degrees, press R to turn`}>
                    Turn R · {state.rot}°
                </span>
            )}
            <span className="bw-building-esc">Esc</span>
        </div>
    );
}
