"use client";

// The tag that follows the mouse over a placed building when no tool is armed, so you can tell what a machine is
// (and what it does) without clicking it. Mouse only; touch has no hover. It draws through the shared Brasswork
// tooltip layer, so it matches every other tag.
import { useEffect } from "react";
import type { InputController } from "@/lib/automation/input";
import type { TipData } from "@/lib/automation/tips";
import { showPointerTip } from "@/components/brasswork-ui/tip";

export function HoverName({ input, tipOf, canvas }: { input: InputController; tipOf: (kind: string) => TipData | null; canvas: React.RefObject<HTMLCanvasElement | null> }) {
    useEffect(() => {
        const build = input.build;
        let current: TipData | null = null;
        let at = { x: 0, y: 0 };
        const draw = () => showPointerTip(at.x, at.y, current, canvas.current?.closest(".ab-root") ?? null);
        const move = (e: PointerEvent) => {
            if (e.pointerType === "touch" || !current) return;
            at = { x: e.clientX, y: e.clientY };
            draw();
        };
        const sync = () => {
            const h = build.getHover();
            const item = h && !build.getTool() ? build.peek(h) : null;
            const next = item ? tipOf(item.kind) : null;
            if (!next) {
                current = null;
                showPointerTip(0, 0, null);
                return;
            }
            const changed = JSON.stringify(next) !== JSON.stringify(current);
            current = next;
            if (changed) draw();
        };
        window.addEventListener("pointermove", move);
        const off = build.subscribe(sync);
        return () => {
            window.removeEventListener("pointermove", move);
            off();
            showPointerTip(0, 0, null);
        };
    }, [input, tipOf, canvas]);
    return null;
}
