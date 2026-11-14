import { type BoardSize, type Cell } from "./grid";
import { type HeightFn, pickGround, screenRay } from "./picking";
import { type OrbitCamera } from "./camera";
import { type BuildController } from "./build";

export interface PointerOptions {
    element: HTMLElement;
    camera: OrbitCamera;
    build: BuildController;
    board: BoardSize;
    heightAt?: HeightFn;
    // Touch: how long a finger has to rest on a cell before it starts a line stroke.
    holdMs?: number;
    // Touch: how far a finger may wander before it counts as a pan.
    slopPx?: number;
    onChange?: () => void;
}

type Mode = "pending" | "pan" | "orbit" | "stroke" | "pinch" | "ignored";

interface Tracked {
    id: number;
    x: number;
    y: number;
    sx: number;
    sy: number;
    type: string;
    button: number;
    mode: Mode;
    hold?: ReturnType<typeof setTimeout>;
    // True for a left press with no tool and no space: a short release counts as a select click.
    click?: boolean;
}

const ORBIT_YAW = 0.008;
const ORBIT_PITCH = 0.005;

// Turns DOM pointer events into camera moves and placement strokes.
// Desktop: left drag places (or pans when no tool is active), middle or space+drag pans, right drag orbits, wheel zooms.
// Touch: one finger pans, a quick tap places one cell, a rest-then-drag draws a line, two fingers pinch zoom and rotate.
export class PointerInput {
    private opts: Required<Omit<PointerOptions, "heightAt" | "onChange">> & Pick<PointerOptions, "heightAt" | "onChange">;
    private pointers = new Map<number, Tracked>();
    private spaceDown = false;
    private pinchPrev: { dist: number; angle: number } | null = null;
    private attached = false;

    constructor(options: PointerOptions) {
        this.opts = { holdMs: 350, slopPx: 10, ...options };
    }

    attach(): void {
        if (this.attached) return;
        this.attached = true;
        const el = this.opts.element;
        el.style.touchAction = "none";
        el.addEventListener("pointerdown", this.onDown);
        el.addEventListener("pointermove", this.onMove);
        el.addEventListener("pointerup", this.onUp);
        el.addEventListener("pointercancel", this.onUp);
        el.addEventListener("pointerleave", this.onLeave);
        el.addEventListener("wheel", this.onWheel, { passive: false });
        el.addEventListener("contextmenu", this.onContext);
    }

    detach(): void {
        if (!this.attached) return;
        this.attached = false;
        const el = this.opts.element;
        el.removeEventListener("pointerdown", this.onDown);
        el.removeEventListener("pointermove", this.onMove);
        el.removeEventListener("pointerup", this.onUp);
        el.removeEventListener("pointercancel", this.onUp);
        el.removeEventListener("pointerleave", this.onLeave);
        el.removeEventListener("wheel", this.onWheel);
        el.removeEventListener("contextmenu", this.onContext);
        for (const p of this.pointers.values()) if (p.hold) clearTimeout(p.hold);
        this.pointers.clear();
    }

    setSpace(down: boolean): void {
        this.spaceDown = down;
    }

    // Cell under a client-space point, or null off the board.
    cellAt(clientX: number, clientY: number): Cell | null {
        const rect = this.opts.element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
        const view = this.opts.camera.view(rect.width / rect.height);
        const hit = pickGround(screenRay(view, ndcX, ndcY), this.opts.board, this.opts.heightAt);
        return hit ? hit.cell : null;
    }

    // World point under a client-space point (continuous, not snapped to a cell), or null off the board.
    private groundAt(clientX: number, clientY: number): { x: number; z: number } | null {
        const rect = this.opts.element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
        const view = this.opts.camera.view(rect.width / rect.height);
        const hit = pickGround(screenRay(view, ndcX, ndcY), this.opts.board, this.opts.heightAt);
        return hit ? { x: hit.point.x, z: hit.point.z } : null;
    }

    private changed(): void {
        this.opts.onChange?.();
    }

    private viewportH(): number {
        return this.opts.element.getBoundingClientRect().height || 1;
    }

    private onDown = (e: PointerEvent): void => {
        const el = this.opts.element;
        try {
            el.setPointerCapture(e.pointerId);
        } catch {
            /* synthetic events have no capture */
        }
        const p: Tracked = {
            id: e.pointerId,
            x: e.clientX,
            y: e.clientY,
            sx: e.clientX,
            sy: e.clientY,
            type: e.pointerType,
            button: e.button,
            mode: "pending",
        };
        this.pointers.set(e.pointerId, p);

        if (this.pointers.size >= 2) {
            // A second finger cancels any stroke and starts a pinch with both fingers.
            this.opts.build.cancelStroke();
            for (const q of this.pointers.values()) {
                if (q.hold) clearTimeout(q.hold);
                q.mode = "pinch";
            }
            this.pinchPrev = this.pinchState();
            this.changed();
            return;
        }

        if (e.pointerType === "touch") {
            p.mode = "pending";
            p.hold = setTimeout(() => this.onHold(p.id), this.opts.holdMs);
            return;
        }

        // Mouse and pen.
        if (e.button === 2) {
            p.mode = "orbit";
        } else if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
            p.mode = "pan";
        } else if (e.button === 0) {
            p.click = !this.opts.build.getTool();
            if (this.opts.build.getTool()) {
                const cell = this.cellAt(e.clientX, e.clientY);
                if (cell) {
                    p.mode = "stroke";
                    this.opts.build.beginStroke(cell);
                } else {
                    p.mode = "ignored";
                }
            } else {
                p.mode = "pan";
            }
        } else {
            p.mode = "ignored";
        }
        this.changed();
    };

    // Touch long-press (no movement for holdMs). What it does depends on what is under the finger:
    //   building under the finger: quarter-turn that building (Delete tool removes it instead)
    //   empty cell, machine tool: quarter-turn the ghost
    //   empty cell, line tool (belts): start a drag-to-place line
    private onHold(id: number): void {
        const p = this.pointers.get(id);
        if (!p || p.mode !== "pending") return;
        p.hold = undefined;
        const cell = this.cellAt(p.x, p.y);
        const build = this.opts.build;
        const tool = build.getTool();
        if (!cell) return;
        if (build.peek(cell)) {
            if (tool?.id === "delete") build.deleteAt(cell);
            else build.rotateAt(cell);
            p.mode = "ignored";
            this.changed();
            return;
        }
        if (!tool) return;
        if (!tool.line) {
            build.rotateCw();
            p.mode = "ignored";
            this.changed();
            return;
        }
        p.mode = "stroke";
        build.beginStroke(cell);
        this.changed();
    }

    private onMove = (e: PointerEvent): void => {
        const p = this.pointers.get(e.pointerId);
        if (!p) {
            // Hover for mouse and pen. Touch only previews while a stroke is running.
            if (e.pointerType !== "touch") {
                this.opts.build.setHover(this.cellAt(e.clientX, e.clientY));
            }
            return;
        }
        const dx = e.clientX - p.x;
        const dy = e.clientY - p.y;
        p.x = e.clientX;
        p.y = e.clientY;

        if (p.mode === "pinch") {
            this.applyPinch();
            return;
        }
        if (p.mode === "pending") {
            if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > this.opts.slopPx) {
                if (p.hold) clearTimeout(p.hold);
                p.hold = undefined;
                p.mode = "pan";
            } else {
                return;
            }
        }
        switch (p.mode) {
            case "pan":
                this.opts.camera.panPixels(dx, dy, this.viewportH());
                break;
            case "orbit":
                this.opts.camera.rotate(-dx * ORBIT_YAW);
                this.opts.camera.tilt(dy * ORBIT_PITCH);
                break;
            case "stroke": {
                const cell = this.cellAt(e.clientX, e.clientY);
                if (cell) this.opts.build.updateStroke(cell);
                break;
            }
            default:
                if (e.pointerType !== "touch") this.opts.build.setHover(this.cellAt(e.clientX, e.clientY));
        }
        this.changed();
    };

    private onUp = (e: PointerEvent): void => {
        const p = this.pointers.get(e.pointerId);
        if (!p) return;
        if (p.hold) clearTimeout(p.hold);
        this.pointers.delete(e.pointerId);
        try {
            this.opts.element.releasePointerCapture(e.pointerId);
        } catch {
            /* ignore */
        }

        if (p.mode === "stroke") {
            this.opts.build.endStroke();
        } else if (p.mode === "pending" && e.type === "pointerup") {
            // Quick touch tap: place a single cell, or select a building when no tool is active.
            const cell = this.cellAt(e.clientX, e.clientY);
            if (cell) {
                if (this.opts.build.getTool()) this.opts.build.tap(cell);
                else this.opts.build.select(cell);
            }
        } else if (p.mode === "pan" && p.click && e.type === "pointerup" && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) <= this.opts.slopPx) {
            // Mouse click with no tool: a short release on a building selects it. A drag still pans.
            const cell = this.cellAt(e.clientX, e.clientY);
            if (cell) this.opts.build.select(cell);
        }

        if (this.pointers.size < 2) {
            this.pinchPrev = null;
            // A finger left over from a pinch does nothing until it lifts.
            for (const q of this.pointers.values()) if (q.mode === "pinch") q.mode = "ignored";
        }
        this.changed();
    };

    private onLeave = (e: PointerEvent): void => {
        if (e.pointerType !== "touch" && !this.pointers.has(e.pointerId)) this.opts.build.setHover(null);
        this.changed();
    };

    private onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        // Trackpad pinch arrives as ctrl+wheel with small deltas. Wheel steps are larger, so keep both readable.
        const k = e.ctrlKey ? 0.01 : 0.0015;
        // Zoom toward the cursor so the spot under the mouse stays put.
        this.opts.camera.zoomAt(Math.exp(dy * k), this.groundAt(e.clientX, e.clientY));
        this.changed();
    };

    private onContext = (e: Event): void => {
        e.preventDefault();
    };

    private pinchState(): { dist: number; angle: number } {
        const [a, b] = [...this.pointers.values()];
        return {
            dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            angle: Math.atan2(b.y - a.y, b.x - a.x),
        };
    }

    private applyPinch(): void {
        if (this.pointers.size < 2 || !this.pinchPrev) return;
        const next = this.pinchState();
        // Fingers spread apart means zoom in, so the factor is previous over current.
        // Zoom toward the midpoint between the fingers.
        const [a, b] = [...this.pointers.values()];
        const mid = this.groundAt((a.x + b.x) / 2, (a.y + b.y) / 2);
        this.opts.camera.zoomAt(this.pinchPrev.dist / next.dist, mid);
        let dAngle = next.angle - this.pinchPrev.angle;
        if (dAngle > Math.PI) dAngle -= 2 * Math.PI;
        if (dAngle < -Math.PI) dAngle += 2 * Math.PI;
        this.opts.camera.rotate(-dAngle);
        this.pinchPrev = next;
        this.changed();
    }
}
