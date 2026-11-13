import { type BoardSize, type Cell, type Rot, cellInBoard, lineCells, rotate } from "./grid";

// What the world stores in a cell. The renderer and the simulation own what "kind" means.
export interface ItemRef {
    kind: string;
    rot: Rot;
}

// The world adapter is the only thing the input layer needs from the simulation.
export interface BuildWorld {
    get(x: number, z: number): ItemRef | null;
    set(x: number, z: number, item: ItemRef | null): void;
    // Null when the item can go in this cell. Otherwise a short reason, such as "blocked" or "needs power".
    check?(kind: string, x: number, z: number, rot: Rot): string | null;
}

export interface ToolSpec {
    id: string;
    label: string;
    // Line tools draw a straight run on drag (belts). Others place one cell per press.
    line: boolean;
}

export const DELETE_TOOL: ToolSpec = { id: "delete", label: "Delete", line: true };

export interface GhostCell {
    x: number;
    z: number;
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
        const count = ghost ? this.commit(ghost.cells) : 0;
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
        return this.commit([{ x: cell.x, z: cell.z, rot: before.rot, valid: true, reason: null, existing: before }], true);
    }

    ghost(): Ghost | null {
        if (!this.tool) return null;
        let raw: { x: number; z: number }[];
        let rot = this.rot;
        if (this.stroke) {
            if (this.tool.line) {
                const run = lineCells(this.stroke.anchor, this.stroke.cur, this.rot);
                raw = run.cells;
                rot = run.rot;
            } else {
                raw = [this.stroke.anchor];
            }
        } else if (this.hover) {
            raw = [this.hover];
        } else {
            return null;
        }
        const cells = raw.map((c) => this.evaluate(c.x, c.z, rot));
        return {
            tool: this.tool,
            cells,
            rot,
            stroking: this.stroke !== null,
            validCount: cells.filter((c) => c.valid).length,
        };
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

    private evaluate(x: number, z: number, rot: Rot): GhostCell {
        const existing = cellInBoard({ x, z }, this.board) ? this.world.get(x, z) : null;
        const base = { x, z, rot, existing };
        if (!cellInBoard({ x, z }, this.board)) return { ...base, valid: false, reason: "outside" };
        if (this.tool?.id === DELETE_TOOL.id) {
            return existing ? { ...base, valid: true, reason: null } : { ...base, valid: false, reason: "empty" };
        }
        if (existing) return { ...base, valid: false, reason: sameItem(existing, { kind: this.tool!.id, rot }) ? "same" : "occupied" };
        const reason = this.world.check ? this.world.check(this.tool!.id, x, z, rot) : null;
        return { ...base, valid: reason === null, reason };
    }

    private commit(cells: GhostCell[], isDelete = false): number {
        const valid = cells.filter((c) => c.valid);
        if (valid.length === 0) {
            const first = cells.find((c) => c.reason)?.reason;
            if (first && !isDelete && this.tool) this.onEvent?.({ type: "invalid", reason: first });
            return 0;
        }
        const del = isDelete || this.tool?.id === DELETE_TOOL.id;
        const edits: Edit[] = [];
        for (const c of valid) {
            const after: ItemRef | null = del ? null : { kind: this.tool!.id, rot: c.rot };
            if (sameItem(c.existing, after)) continue;
            edits.push({ x: c.x, z: c.z, before: c.existing, after });
        }
        if (edits.length === 0) return 0;
        for (const e of edits) this.world.set(e.x, e.z, e.after);
        this.undoStack.push(edits);
        if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
        this.redoStack = [];
        this.onEvent?.(del ? { type: "remove", count: edits.length } : { type: "place", count: edits.length });
        return edits.length;
    }

    private emit(): void {
        for (const fn of this.listeners) fn();
    }
}
