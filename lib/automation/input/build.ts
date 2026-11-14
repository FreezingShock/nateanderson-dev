import { type BoardSize, type Cell, type Rot, cellInBoard, cellKey, lineCells, rotate, rotFromDelta } from "./grid";

// Pencil path: walks from the last cell toward the target one cell at a time (x first, then z), so a fast
// drag still draws a connected line. Stepping back onto the previous cell erases the last one, so dragging
// back over a stroke undoes it.
export function extendPath(path: Cell[], target: Cell): Cell[] {
    const p = path.map((c) => ({ x: c.x, z: c.z }));
    for (let guard = 0; guard < 400; guard++) {
        const last = p[p.length - 1];
        const dx = target.x - last.x;
        const dz = target.z - last.z;
        if (dx === 0 && dz === 0) break;
        const next = Math.abs(dx) >= Math.abs(dz) ? { x: last.x + Math.sign(dx), z: last.z } : { x: last.x, z: last.z + Math.sign(dz) };
        const back = p.length >= 2 ? p[p.length - 2] : null;
        if (back && back.x === next.x && back.z === next.z) {
            p.pop();
            continue;
        }
        p.push(next);
    }
    return p;
}

// Each cell faces the next cell of the path; the last cell faces the way the stroke was going.
export function pathRots(path: Cell[], fallback: Rot): Rot[] {
    return path.map((c, i) => {
        if (i < path.length - 1) return rotFromDelta(path[i + 1].x - c.x, path[i + 1].z - c.z, fallback);
        if (path.length > 1) return rotFromDelta(c.x - path[i - 1].x, c.z - path[i - 1].z, fallback);
        return fallback;
    });
}

// What the world stores in a cell. The renderer and the simulation own what "kind" means.
// anchor is the building's anchor cell when the world knows it. Otherwise the cell is its own anchor.
export interface ItemRef {
    kind: string;
    rot: Rot;
    anchor?: Cell;
}

// The world adapter is the only thing the input layer needs from the simulation.
export interface BuildWorld {
    get(x: number, z: number): ItemRef | null;
    set(x: number, z: number, item: ItemRef | null): void;
    // Null when the item can go in this cell. Otherwise a short reason, such as "blocked" or "needs power".
    // The sim's check covers the whole footprint, so the ghost applies it to every cell of that footprint.
    check?(kind: string, x: number, z: number, rot: Rot): string | null;
}

export interface Footprint {
    w: number;
    d: number;
}

export interface ToolSpec {
    id: string;
    label: string;
    // Line tools draw a straight run on drag (belts). Others place one anchor per press.
    line: boolean;
    // Footprint in cells, before rotation. Missing means 1 by 1. Must match the sim's footprintCells.
    footprint?: Footprint;
}

export const DELETE_TOOL: ToolSpec = { id: "delete", label: "Delete", line: true };

export interface Offset {
    dx: number;
    dz: number;
}

// Cells a building covers when anchored at its minimum corner. Rotations 1 and 3 swap width and depth.
// Mirrors footprintCells in lib/automation/sim/world.ts.
export function footprintOffsets(fp: Footprint | undefined, rot: Rot): Offset[] {
    const f = fp ?? { w: 1, d: 1 };
    const swap = rot === 1 || rot === 3;
    const fw = swap ? f.d : f.w;
    const fd = swap ? f.w : f.d;
    const out: Offset[] = [];
    for (let dz = 0; dz < fd; dz++) for (let dx = 0; dx < fw; dx++) out.push({ dx, dz });
    return out;
}

export interface GhostCell {
    x: number;
    z: number;
    // Anchor of the footprint this cell belongs to. For a 1 by 1 tool it is the cell itself.
    ax: number;
    az: number;
    rot: Rot;
    valid: boolean;
    reason: string | null;
    existing: ItemRef | null;
}

export interface Ghost {
    tool: ToolSpec;
    cells: GhostCell[];
    rot: Rot;
    stroking: boolean;
    // Placeable anchors (or, for delete, removable cells).
    validCount: number;
    // Why the first refused cell is refused, or null when the whole preview is valid. Shown next to the ghost.
    reason: string | null;
}

export type BuildEvent =
    | { type: "place"; count: number; cells: Cell[] }
    | { type: "remove"; count: number; cells: Cell[] }
    | { type: "rotate" }
    | { type: "invalid"; reason: string }
    | { type: "undo" }
    | { type: "redo" }
    // A press on a placed building with no tool active. The host decides what selecting means (inspector, highlight).
    | { type: "select"; cell: Cell; anchor: Cell; kind: string };

interface Edit {
    x: number;
    z: number;
    before: ItemRef | null;
    after: ItemRef | null;
}

export interface BuildOptions {
    world: BuildWorld;
    board: BoardSize;
    historyLimit?: number;
    onEvent?: (e: BuildEvent) => void;
    // Kinds that form runs (belts). runAt follows neighbours of these kinds.
    lineKinds?: string[];
}

const sameItem = (a: ItemRef | null, b: ItemRef | null) => (!a && !b) || (!!a && !!b && a.kind === b.kind && a.rot === b.rot);

// Placement state machine. Owns the tool, rotation, the hover cell, the drag stroke, ghost preview and undo.
// Nothing here touches the DOM, so the same code runs in Node tests and in the browser.
export class BuildController {
    private world: BuildWorld;
    private board: BoardSize;
    private historyLimit: number;
    private onEvent?: (e: BuildEvent) => void;

    private tool: ToolSpec | null = null;
    private rot: Rot = 0;
    private hover: Cell | null = null;
    private stroke: { anchor: Cell; cur: Cell; path: Cell[] } | null = null;
    private undoStack: Edit[][] = [];
    private redoStack: Edit[][] = [];
    private listeners = new Set<() => void>();
    private lineKinds: Set<string>;
    private highlight: Cell[] = [];

    constructor(opts: BuildOptions) {
        this.world = opts.world;
        this.board = opts.board;
        this.historyLimit = opts.historyLimit ?? 200;
        this.onEvent = opts.onEvent;
        this.lineKinds = new Set(opts.lineKinds ?? []);
    }

    // Every cell in the connected run of line pieces (belts) that holds this cell, found by walking
    // neighbours of the same family. Empty when the cell holds no line piece.
    runAt(cell: Cell): Cell[] {
        const start = this.world.get(cell.x, cell.z);
        if (!start || !this.lineKinds.has(start.kind)) return [];
        const seen = new Set<string>([cellKey(cell)]);
        const out: Cell[] = [{ x: cell.x, z: cell.z }];
        const queue: Cell[] = [{ x: cell.x, z: cell.z }];
        const steps = [
            { x: 1, z: 0 },
            { x: -1, z: 0 },
            { x: 0, z: 1 },
            { x: 0, z: -1 },
        ];
        while (queue.length) {
            const c = queue.shift()!;
            for (const d of steps) {
                const n = { x: c.x + d.x, z: c.z + d.z };
                const k = cellKey(n);
                if (seen.has(k) || !cellInBoard(n, this.board)) continue;
                seen.add(k);
                const item = this.world.get(n.x, n.z);
                if (item && this.lineKinds.has(item.kind)) {
                    out.push(n);
                    queue.push(n);
                }
            }
        }
        return out;
    }

    // Removes every building in the given cells as one undo step. Multi-cell buildings count once.
    removeCells(cells: Cell[]): number {
        const seen = new Set<string>();
        const edits: Edit[] = [];
        for (const c of cells) {
            const before = this.world.get(c.x, c.z);
            if (!before) continue;
            const anchor = before.anchor ?? c;
            const k = cellKey(anchor);
            if (seen.has(k)) continue;
            seen.add(k);
            edits.push({ x: anchor.x, z: anchor.z, before, after: null });
        }
        this.highlight = [];
        return this.commitEdits(edits, "remove");
    }

    // Cells to outline as a selection (for example a whole belt run). Cleared on any edit.
    setHighlight(cells: Cell[]): void {
        this.highlight = cells.map((c) => ({ x: c.x, z: c.z }));
        this.emit();
    }

    getHighlight(): Cell[] {
        return this.highlight.map((c) => ({ ...c }));
    }

    getTool(): ToolSpec | null {
        return this.tool;
    }

    setTool(tool: ToolSpec | null): void {
        this.stroke = null;
        this.tool = tool;
        this.emit();
    }

    getRot(): Rot {
        return this.rot;
    }

    setRot(rot: Rot): void {
        this.rot = rot;
        this.emit();
    }

    rotateCw(): Rot {
        this.rot = rotate(this.rot, 1);
        this.emit();
        return this.rot;
    }

    setHover(cell: Cell | null): void {
        const same = (this.hover?.x ?? null) === (cell?.x ?? null) && (this.hover?.z ?? null) === (cell?.z ?? null);
        if (same) return;
        this.hover = cell ? { x: cell.x, z: cell.z } : null;
        this.emit();
    }

    getHover(): Cell | null {
        return this.hover ? { ...this.hover } : null;
    }

    isStroking(): boolean {
        return this.stroke !== null;
    }

    beginStroke(cell: Cell): void {
        if (!this.tool) return;
        this.stroke = { anchor: { ...cell }, cur: { ...cell }, path: [{ ...cell }] };
        this.hover = { ...cell };
        this.emit();
    }

    updateStroke(cell: Cell): void {
        if (!this.stroke) return;
        this.hover = { ...cell };
        this.stroke.cur = { ...cell };
        if (this.tool?.line) this.stroke.path = extendPath(this.stroke.path, cell);
        this.emit();
    }

    // Commits the stroke. Returns how many cells changed.
    endStroke(): number {
        if (!this.stroke || !this.tool) {
            this.stroke = null;
            return 0;
        }
        const ghost = this.ghost();
        this.stroke = null;
        const count = ghost ? this.commit(ghost) : 0;
        this.emit();
        return count;
    }

    cancelStroke(): void {
        if (!this.stroke) return;
        this.stroke = null;
        this.emit();
    }

    // One press on a cell. Same as begin and end with a single cell.
    tap(cell: Cell): number {
        if (!this.tool) return 0;
        this.beginStroke(cell);
        return this.endStroke();
    }

    // Removes whatever sits under the cell, no tool needed. Used by the Delete key.
    deleteAt(cell: Cell): number {
        const before = this.world.get(cell.x, cell.z);
        if (!before) return 0;
        const anchor = before.anchor ?? cell;
        this.commitEdits([{ x: anchor.x, z: anchor.z, before, after: null }], "remove");
        return 1;
    }

    // What covers this cell, or null. Used by the touch long-press.
    peek(cell: Cell): ItemRef | null {
        return this.world.get(cell.x, cell.z);
    }

    // Selects the building under the cell (no tool needed). Returns false on empty cells.
    select(cell: Cell): boolean {
        const here = this.world.get(cell.x, cell.z);
        if (!here) return false;
        const anchor = here.anchor ?? { x: cell.x, z: cell.z };
        this.onEvent?.({ type: "select", cell: { x: cell.x, z: cell.z }, anchor: { x: anchor.x, z: anchor.z }, kind: here.kind });
        return true;
    }

    // The R key. Over a placed building (and not mid-drag) it turns that building, otherwise it turns the ghost.
    rotateHover(): void {
        const h = this.hover;
        if (h && !this.stroke && this.world.get(h.x, h.z)) {
            this.rotateAt(h);
            return;
        }
        this.rotateCw();
    }

    // Quarter-turns the building that covers this cell, in one undo step. The building is lifted first so
    // its own cells don't block the check. Returns false when the turned footprint doesn't fit.
    rotateAt(cell: Cell): boolean {
        const here = this.world.get(cell.x, cell.z);
        if (!here) return false;
        const anchor = here.anchor ?? { x: cell.x, z: cell.z };
        const next: ItemRef = { kind: here.kind, rot: rotate(here.rot, 1), anchor };
        this.world.set(anchor.x, anchor.z, null);
        const reason = this.world.check ? this.world.check(next.kind, anchor.x, anchor.z, next.rot) : null;
        if (reason) {
            this.world.set(anchor.x, anchor.z, here);
            this.onEvent?.({ type: "invalid", reason });
            return false;
        }
        this.world.set(anchor.x, anchor.z, next);
        this.undoStack.push([{ x: anchor.x, z: anchor.z, before: here, after: next }]);
        if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
        this.redoStack = [];
        this.onEvent?.({ type: "rotate" });
        this.emit();
        return true;
    }

    ghost(): Ghost | null {
        if (!this.tool) return null;
        const tool = this.tool;
        let anchors: Cell[];
        let rot = this.rot;
        // Per-anchor rotation: pencil strokes turn at every cell, so each cell carries its own rot.
        let rots: Rot[] | null = null;
        if (this.stroke) {
            if (tool.line) {
                anchors = this.stroke.path;
                rots = pathRots(anchors, this.rot);
                rot = rots[rots.length - 1];
            } else {
                anchors = [this.stroke.anchor];
            }
        } else if (this.hover) {
            anchors = [this.hover];
        } else {
            return null;
        }

        const cells: GhostCell[] = [];
        let validCount = 0;
        const isDelete = tool.id === DELETE_TOOL.id;
        for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            const r = rots ? rots[i] : rot;
            // Deletes and 1 by 1 tools look at one cell per anchor. Footprint tools look at every covered cell.
            const offsets = isDelete ? [{ dx: 0, dz: 0 }] : footprintOffsets(tool.footprint, r);
            const anchorReason = isDelete || !this.world.check ? null : this.world.check(tool.id, a.x, a.z, r);
            const group: GhostCell[] = offsets.map((o) => this.evaluate(a.x + o.dx, a.z + o.dz, r, a, anchorReason));
            cells.push(...group);
            if (isDelete) validCount += group.filter((c) => c.valid).length;
            else if (group.every((c) => c.valid)) validCount += 1;
        }
        const firstBad = cells.find((c) => !c.valid && c.reason && c.reason !== "same");
        const reason = isDelete ? (validCount === 0 ? "nothing to remove" : null) : firstBad?.reason ?? null;
        return { tool, cells, rot, stroking: this.stroke !== null, validCount, reason };
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    undo(): boolean {
        const edits = this.undoStack.pop();
        if (!edits) return false;
        for (let i = edits.length - 1; i >= 0; i--) applyEdit(this.world, edits[i], "undo");
        this.redoStack.push(edits);
        this.onEvent?.({ type: "undo" });
        this.emit();
        return true;
    }

    redo(): boolean {
        const edits = this.redoStack.pop();
        if (!edits) return false;
        for (const e of edits) applyEdit(this.world, e, "redo");
        this.undoStack.push(edits);
        this.onEvent?.({ type: "redo" });
        this.emit();
        return true;
    }

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private evaluate(x: number, z: number, rot: Rot, anchor: Cell, anchorReason: string | null): GhostCell {
        const inside = cellInBoard({ x, z }, this.board);
        const existing = inside ? this.world.get(x, z) : null;
        const base = { x, z, ax: anchor.x, az: anchor.z, rot, existing };
        if (!inside) return { ...base, valid: false, reason: "outside" };
        if (this.tool?.id === DELETE_TOOL.id) {
            return existing ? { ...base, valid: true, reason: null } : { ...base, valid: false, reason: "empty" };
        }
        if (existing) {
            const same = existing.kind === this.tool!.id && existing.rot === rot;
            return { ...base, valid: false, reason: same ? "same" : "occupied" };
        }
        return { ...base, valid: anchorReason === null, reason: anchorReason };
    }

    // Turns a ghost into edits. A placement needs its whole footprint to be valid. A delete removes each
    // building once, even when it covers several of the selected cells.
    private commit(ghost: Ghost): number {
        const isDelete = ghost.tool.id === DELETE_TOOL.id;
        const edits: Edit[] = [];
        if (isDelete) {
            const seen = new Set<string>();
            for (const c of ghost.cells) {
                if (!c.valid || !c.existing) continue;
                const anchor = c.existing.anchor ?? { x: c.x, z: c.z };
                const k = cellKey(anchor);
                if (seen.has(k)) continue;
                seen.add(k);
                edits.push({ x: anchor.x, z: anchor.z, before: c.existing, after: null });
            }
            return this.commitEdits(edits, "remove");
        }

        const groups = new Map<string, GhostCell[]>();
        for (const c of ghost.cells) {
            const k = `${c.ax},${c.az}`;
            const g = groups.get(k);
            if (g) g.push(c);
            else groups.set(k, [c]);
        }
        let firstReason: string | null = null;
        for (const [, g] of groups) {
            const bad = g.find((c) => !c.valid);
            if (bad) {
                firstReason = firstReason ?? bad.reason;
                continue;
            }
            const after: ItemRef = { kind: ghost.tool.id, rot: g[0].rot };
            if (sameItem(g[0].existing, after)) continue;
            edits.push({ x: g[0].ax, z: g[0].az, before: null, after });
        }
        if (edits.length === 0) {
            if (firstReason) this.onEvent?.({ type: "invalid", reason: firstReason });
            return 0;
        }
        return this.commitEdits(edits, "place");
    }

    private commitEdits(edits: Edit[], kind: "place" | "remove" | "rotate"): number {
        if (edits.length === 0) return 0;
        this.highlight = [];
        for (const e of edits) applyEdit(this.world, e, "redo");
        this.undoStack.push(edits);
        if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
        this.redoStack = [];
        this.onEvent?.(kind === "rotate" ? { type: "rotate" } : { type: kind, count: edits.length, cells: edits.map((e) => ({ x: e.x, z: e.z })) });
        this.emit();
        return edits.length;
    }

    private emit(): void {
        for (const fn of this.listeners) fn();
    }
}

// Writes one edit forwards (redo) or backwards (undo). A rotation has both a before and an after, so the
// old building is lifted before the new one goes in. Placements and removals have one side, so only that side runs.
function applyEdit(world: BuildWorld, e: Edit, dir: "undo" | "redo"): void {
    const from = dir === "redo" ? e.before : e.after;
    const to = dir === "redo" ? e.after : e.before;
    if (from) world.set(e.x, e.z, null);
    if (to) world.set(e.x, e.z, to);
}
