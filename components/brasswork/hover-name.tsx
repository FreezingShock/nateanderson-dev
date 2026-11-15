"use client";

// A small name tag that follows the mouse over a placed building when no tool is armed, so you can tell what a
// machine is without clicking it. Mouse only; touch has no hover. Under the menus, ignores clicks.
import { useEffect, useRef, useState } from "react";
import type { InputController } from "@/lib/automation/input";
import "./hover-name.css";

export function HoverName({ input, nameOf, canvas }: { input: InputController; nameOf: (kind: string) => string; canvas: React.RefObject<HTMLCanvasElement | null> }) {
    const ref = useRef<HTMLDivElement>(null);
    const [label, setLabel] = useState("");
    useEffect(() => {
        const build = input.build;
        const move = (e: PointerEvent) => {
            const el = ref.current;
            const cv = canvas.current;
            if (!el || !cv || e.pointerType === "touch") return;
            const r = cv.getBoundingClientRect();
            el.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 16}px)`;
        };
        const sync = () => {
            const h = build.getHover();
            const item = h && !build.getTool() ? build.peek(h) : null;
            setLabel(item ? nameOf(item.kind) : "");
        };
        window.addEventListener("pointermove", move);
        const off = build.subscribe(sync);
        return () => {
            window.removeEventListener("pointermove", move);
            off();
        };
    }, [input, nameOf, canvas]);
    return (
        <div ref={ref} className="bw-hovername" aria-hidden="true" data-on={label ? "1" : "0"}>
            {label}
        </div>
    );
}
