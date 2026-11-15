"use client";

// Marks on the island where the NEXT banner wants you to build. Four brass corner brackets that breathe, pinned to the
// spot every frame. It lives inside the stage, under the menus, and ignores clicks.
import { useEffect, useRef, type RefObject } from "react";
import type { InputController } from "@/lib/automation/input";
import "./next-marker.css";

export interface NextTarget {
    // Input-frame cell of the footprint's minimum corner, and its size in cells.
    x: number;
    z: number;
    w: number;
    d: number;
    label: string;
}

export function NextMarker({ input, target, canvas }: { input: InputController; target: NextTarget; canvas: RefObject<HTMLCanvasElement | null> }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let raf = 0;
        const place = () => {
            const el = ref.current;
            const cv = canvas.current;
            if (el && cv) {
                const origin = cv.getBoundingClientRect();
                const pts = [
                    input.screenPoint({ x: target.x, z: target.z }),
                    input.screenPoint({ x: target.x + target.w - 1, z: target.z }),
                    input.screenPoint({ x: target.x, z: target.z + target.d - 1 }),
                    input.screenPoint({ x: target.x + target.w - 1, z: target.z + target.d - 1 }),
                ];
                if (pts.some((p) => !p)) el.style.opacity = "0";
                else {
                    const ps = pts as { x: number; y: number }[];
                    const cx = ps.reduce((a, p) => a + p.x, 0) / 4;
                    const cy = ps.reduce((a, p) => a + p.y, 0) / 4;
                    // One cell on screen, from the first two cell centres (or the next row when the footprint is one wide).
                    const step = input.screenPoint({ x: target.x + 1, z: target.z });
                    const cell = step ? Math.hypot(step.x - ps[0].x, step.y - ps[0].y) : 40;
                    const size = Math.max(52, Math.max(target.w, target.d) * cell * 1.15 + 14);
                    el.style.opacity = "1";
                    el.style.width = el.style.height = `${size}px`;
                    el.style.transform = `translate(${cx - origin.left - size / 2}px, ${cy - origin.top - size / 2}px)`;
                }
            }
            raf = requestAnimationFrame(place);
        };
        raf = requestAnimationFrame(place);
        return () => cancelAnimationFrame(raf);
    }, [input, target, canvas]);
    return (
        <div ref={ref} className="bw-nextmark" aria-hidden="true" style={{ opacity: 0 }}>
            <i /> <i /> <i /> <i />
            <span>{target.label}</span>
        </div>
    );
}
