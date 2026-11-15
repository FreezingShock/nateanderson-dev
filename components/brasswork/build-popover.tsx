"use client";

// Quick actions for a placed building, shown by it when it is clicked or tapped with no tool active.
// Belts also get "Select line", which outlines the whole connected run, and "Remove line", which deletes it in one undo step.
// The inspector (#379) still opens on the same click. This pop-up is the fast path: it sits next to the piece and closes
// on Escape, on a press outside it, or when the piece goes away.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { InputController } from "@/lib/automation/input";
import "./build-popover.css";
import { tipAttr } from "@/components/brasswork-ui/tip";
import { CONTROL_TIPS } from "@/lib/automation/tips";

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
    // Phone: a Details button opens the inspector sheet, since a tap only opens this pop-up there.
    showDetails?: boolean;
    onDetails?: (anchor: Cell) => void;
    onClose: () => void;
}

export function BuildPopover({ input, anchor, kind, kindLabel, x, y, lineKinds, showDetails, onDetails, onClose }: PopoverProps) {
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

    // Portalled to the body so an ancestor's transform or overflow can't move it off the piece.
    const panel = (
        <div ref={ref} className="bp bw" role="dialog" aria-label={`${kindLabel} actions`} style={{ left, top }}>
            <p className="bp-title">{kindLabel}</p>
            <div className="bp-actions">
                {kind === "hub" && <p className="bp-note">The hub is fixed in place.</p>}
                {showDetails && onDetails && (
                    <button type="button" className="bp-btn" data-tone="ghost" {...tipAttr({ title: "Details", tag: "Building", text: "Open the card for this building: recipe, rates, power and what it holds." })} onClick={() => onDetails(anchor)}>
                        Details
                    </button>
                )}
                {kind !== "hub" && isLine && lineCount === 0 && (
                    <button type="button" className="bp-btn" {...tipAttr({ title: "Select whole line", tag: "Belts", text: "Outline the connected run of belts, so you can remove it in one step." })} onClick={selectLine}>
                        Select whole line
                    </button>
                )}
                {kind !== "hub" && isLine && lineCount > 0 && (
                    <button type="button" className="bp-btn" data-tone="danger" {...tipAttr({ title: `Remove ${lineCount} belts`, tag: "Belts", text: "Deletes the whole run in one undo step.", note: "Half the cost of each belt comes back." })} onClick={removeLine}>
                        Remove {lineCount} belts
                    </button>
                )}
                {kind !== "hub" && (
                    <>
                        <button type="button" className="bp-btn" {...tipAttr(CONTROL_TIPS.rotate)} onClick={rotate}>
                            Rotate
                        </button>
                        <button type="button" className="bp-btn" data-tone="danger" {...tipAttr(CONTROL_TIPS.remove)} onClick={remove}>
                            Remove
                        </button>
                    </>
                )}
                {kind !== "hub" && isLine && lineCount > 0 && (
                    <button type="button" className="bp-btn" data-tone="ghost" {...tipAttr({ title: "Clear selection", tag: "Selection", text: "Drop the outline on the selected buildings." })} onClick={() => build.setHighlight([])}>
                        Clear selection
                    </button>
                )}
            </div>
        </div>
    );
    return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}

// A visible trash can for the delete tool. Desktop had only the X key and Delete, which nobody found.
export function TrashButton({ input, variant = "float" }: { input: InputController; variant?: "float" | "dock" }) {
    const build = input.build;
    const active = useSyncExternalStore(
        (cb) => build.subscribe(cb),
        () => build.getTool()?.id === "delete",
        () => false,
    );
    const onClick = () => input.setToolById(active ? null : "delete");
    if (variant === "dock") {
        // The left dock's foot: the same tool, drawn as a trash can with its label and the X key hint.
        return (
            <button
                type="button"
                className="ab-dock-btn ab-dock-trash"
                aria-pressed={active}
                data-armed={active}
                aria-label="Remove tool: click buildings or belts to delete them (X)"
                {...tipAttr(CONTROL_TIPS.remove)}
                onClick={onClick}
            >
                <svg className="ab-dock-ico" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" shapeRendering="crispEdges">
                    {/* Pixel trash can: lid, handle, body with two slots. Brass on dark, so it reads on the dock. */}
                    <rect x="2" y="3" width="12" height="1.5" fill="#ffd98a" />
                    <rect x="6" y="1" width="4" height="2" fill="#ffd98a" />
                    <rect x="3.5" y="5" width="9" height="10" fill="#b8862f" />
                    <rect x="6" y="7" width="1" height="6" fill="#20170c" />
                    <rect x="9" y="7" width="1" height="6" fill="#20170c" />
                </svg>
                <span className="ab-dock-label">Remove</span>
            </button>
        );
    }
    return (
        <button
            type="button"
            className="bt bw"
            aria-pressed={active}
            aria-label="Remove tool: click buildings or belts to delete them"
            {...tipAttr(CONTROL_TIPS.remove)}
            onClick={onClick}
        >
            Remove
        </button>
    );
}
