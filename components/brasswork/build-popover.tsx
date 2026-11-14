"use client";

// Quick actions for a placed building, shown by it when it is clicked or tapped with no tool active.
// Belts also get "Select line", which outlines the whole connected run, and "Remove line", which deletes it in one undo step.
// The inspector (#379) still opens on the same click. This pop-up is the fast path: it sits next to the piece and closes
// on Escape, on a press outside it, or when the piece goes away.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { InputController } from "@/lib/automation/input";
import "./build-popover.css";

type Cell = { x: number; z: number };

interface PopoverProps {
    input: InputController;
    anchor: Cell;
    kind: string;
    kindLabel: string;
    // Client pixels for the pop-up's top-left, computed when it opened.
    x: number;
    y: number;
    lineKinds: string[];
    onClose: () => void;
}

export function BuildPopover({ input, anchor, kind, kindLabel, x, y, lineKinds, onClose }: PopoverProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [, bump] = useState(0);
    const build = input.build;
    const isLine = lineKinds.includes(kind);
    const highlight = build.getHighlight();
    const lineCount = highlight.length;

    // Re-render when the build state changes (highlight, undo) so the buttons stay honest.
    useEffect(() => build.subscribe(() => bump((n) => n + 1)), [build]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        const onDown = (e: PointerEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("pointerdown", onDown, true);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("pointerdown", onDown, true);
        };
    }, [onClose]);

    // Keep the pop-up on screen: flip it to the other side of the piece when it would run off the edge.
    const w = 190;
    const h = isLine ? 200 : 170;
    const left = Math.min(Math.max(8, x + 14), window.innerWidth - w - 8);
    const top = y + h + 14 > window.innerHeight ? Math.max(8, y - h - 14) : y + 14;

    const rotate = () => {
        build.rotateAt(anchor);
    };
    const remove = () => {
        build.deleteAt(anchor);
        onClose();
    };
    const selectLine = () => {
        build.setHighlight(build.runAt(anchor));
    };
    const removeLine = () => {
        build.removeCells(build.getHighlight());
        onClose();
    };

    return (
        <div ref={ref} className="bp bw" role="dialog" aria-label={`${kindLabel} actions`} style={{ left, top }}>
            <p className="bp-title">{kindLabel}</p>
            <div className="bp-actions">
                {isLine && lineCount === 0 && (
                    <button type="button" className="bp-btn" onClick={selectLine}>
                        Select whole line
                    </button>
                )}
                {isLine && lineCount > 0 && (
                    <button type="button" className="bp-btn" data-tone="danger" onClick={removeLine}>
                        Remove {lineCount} belts
                    </button>
                )}
                <button type="button" className="bp-btn" onClick={rotate}>
                    Rotate
                </button>
                <button type="button" className="bp-btn" data-tone="danger" onClick={remove}>
                    Remove
                </button>
                {isLine && lineCount > 0 && (
                    <button type="button" className="bp-btn" data-tone="ghost" onClick={() => build.setHighlight([])}>
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    );
}

// A visible trash can for the delete tool. Desktop had only the X key and Delete, which nobody found.
export function TrashButton({ input }: { input: InputController }) {
    const build = input.build;
    const active = useSyncExternalStore(
        (cb) => build.subscribe(cb),
        () => build.getTool()?.id === "delete",
        () => false,
    );
    return (
        <button
            type="button"
            className="bt bw"
            aria-pressed={active}
            aria-label="Remove tool: click buildings or belts to delete them"
            title="Remove (X)"
            onClick={() => input.setToolById(active ? null : "delete")}
        >
            Trash
        </button>
    );
}
