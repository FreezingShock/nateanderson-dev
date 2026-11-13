import { type BoardSize, type Cell, type Rot, cellInBoard, cellKey, lineCells, rotate } from "./grid";

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
}

export type BuildEvent =
    | { type: "place"; count: number }
    | { type: "remove"; count: number }
    | { type: "invalid"; reason: string }
    | { type: "undo" }
    | { type: "redo" };

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
    private stroke: { anchor: Cell; cur: Cell } | null = null;
    private undoStack: Edit[][] = [];
    private redoStack: Edit[][] = [];
    private listeners = new Set<() => void>();

    constructor(opts: BuildOptions) {
        this.world = opts.world;
        this.board = opts.board;
        this.historyLimit = opts.historyLimit ?? 200;
        this.onEvent = opts.onEvent;
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
        this.stroke = { anchor: { ...cell }, cur: { ...cell } };
        this.hover = { ...cell };
        this.emit();
    }

    updateStroke(cell: Cell): void {
        if (!this.stroke) return;
        this.hover = { ...cell };
        this.stroke.cur = { ...cell };
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

    ghost(): Ghost | null {
        if (!this.tool) return null;
        const tool = this.tool;
        let anchors: Cell[];
        let rot = this.rot;
        if (this.stroke) {
            if (tool.line) {
                const run = lineCells(this.stroke.anchor, this.stroke.cur, this.rot);
                anchors = run.cells;
                rot = run.rot;
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
        for (const a of anchors) {
            // Deletes and 1 by 1 tools look at one cell per anchor. Footprint tools look at every covered cell.
            const offsets = isDelete ? [{ dx: 0, dz: 0 }] : footprintOffsets(tool.footprint, rot);
            const anchorReason = isDelete || !this.world.check ? null : this.world.check(tool.id, a.x, a.z, rot);
            const group: GhostCell[] = offsets.map((o) => this.evaluate(a.x + o.dx, a.z + o.dz, rot, a, anchorReason));
            cells.push(...group);
            if (isDelete) validCount += group.filter((c) => c.valid).length;
            else if (group.every((c) => c.valid)) validCount += 1;
        }
        return { tool, cells, rot, stroking: this.stroke !== null, validCount };
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
        for (let i = edits.length - 1; i >= 0; i--) this.world.set(edits[i].x, edits[i].z, edits[i].before);
        this.redoStack.push(edits);
        this.onEvent?.({ type: "undo" });
        this.emit();
        return true;
    }

    redo(): boolean {
        const edits = this.redoStack.pop();
        if (!edits) return false;
        for (const e of edits) this.world.set(e.x, e.z, e.after);
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

    private commitEdits(edits: Edit[], kind: "place" | "remove"): number {
        if (edits.length === 0) return 0;
        for (const e of edits) this.world.set(e.x, e.z, e.after);
        this.undoStack.push(edits);
        if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
        this.redoStack = [];
        this.onEvent?.({ type: kind, count: edits.length });
        this.emit();
        return edits.length;
    }

    private emit(): void {
        for (const fn of this.listeners) fn();
    }
}
