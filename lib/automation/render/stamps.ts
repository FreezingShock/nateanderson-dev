// Shape stamps for building objects (machines, props) at voxel resolution. Each stamp takes world
// units and writes cells whose centres fall inside the shape, so curves stay smooth at any cell size.
import { VoxelGrid } from "./grid";
import { BlockRegistry } from "./mesher";

export class Stamper {
    private readonly grid: VoxelGrid;
    private readonly blocks: BlockRegistry;

    constructor(grid: VoxelGrid, blocks: BlockRegistry) {
        this.grid = grid;
        this.blocks = blocks;
    }

    /** Axis-aligned box. (x, z) is the centre on the floor, y is the bottom. */
    box(
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        hex: number
    ): void {
        const c = this.grid.cell;
        const id = this.blocks.id(hex);
        const i0 = Math.floor((x - w / 2) / c + 1e-6);
        const i1 = Math.max(i0 + 1, Math.ceil((x + w / 2) / c - 1e-6));
        const j0 = Math.floor(y / c + 1e-6);
        const j1 = Math.max(j0 + 1, Math.ceil((y + h) / c - 1e-6));
        const k0 = Math.floor((z - d / 2) / c + 1e-6);
        const k1 = Math.max(k0 + 1, Math.ceil((z + d / 2) / c - 1e-6));
        for (let i = i0; i < i1; i++)
            for (let j = j0; j < j1; j++)
                for (let k = k0; k < k1; k++) this.grid.set(i, j, k, id);
    }

    /** Vertical cylinder. (x, z) is the centre, y the bottom. */
    cylinder(
        x: number,
        y: number,
        z: number,
        r: number,
        h: number,
        hex: number
    ): void {
        this.ring(x, y, z, h, r, r, hex);
    }

    /** Cone: radius r at the bottom, tapering to a point (0.05 units) at the top. */
    cone(
        x: number,
        y: number,
        z: number,
        r: number,
        h: number,
        hex: number
    ): void {
        this.ring(x, y, z, h, r, 0.05, hex);
    }

    /** Solid of revolution whose radius goes linearly from rBottom to rTop over height h. */
    private ring(
        x: number,
        y: number,
        z: number,
        h: number,
        rBottom: number,
        rTop: number,
        hex: number
    ): void {
        const c = this.grid.cell;
        const id = this.blocks.id(hex);
        const r = Math.max(rBottom, rTop);
        const j0 = Math.floor(y / c + 1e-6);
        const j1 = Math.max(j0 + 1, Math.ceil((y + h) / c - 1e-6));
        const i0 = Math.floor((x - r) / c) - 1;
        const i1 = Math.ceil((x + r) / c) + 1;
        const k0 = Math.floor((z - r) / c) - 1;
        const k1 = Math.ceil((z + r) / c) + 1;
        for (let j = j0; j < j1; j++) {
            const t = (j - j0) / (j1 - j0);
            const rr = rBottom + (rTop - rBottom) * t;
            for (let i = i0; i <= i1; i++)
                for (let k = k0; k <= k1; k++) {
                    if (Math.hypot((i + 0.5) * c - x, (k + 0.5) * c - z) <= rr)
                        this.grid.set(i, j, k, id);
                }
        }
    }

    /** Solid sphere centred at (x, y, z). */
    sphere(x: number, y: number, z: number, r: number, hex: number): void {
        const c = this.grid.cell;
        const id = this.blocks.id(hex);
        for (
            let i = Math.floor((x - r) / c) - 1;
            i <= Math.ceil((x + r) / c) + 1;
            i++
        )
            for (
                let j = Math.floor((y - r) / c) - 1;
                j <= Math.ceil((y + r) / c) + 1;
                j++
            )
                for (
                    let k = Math.floor((z - r) / c) - 1;
                    k <= Math.ceil((z + r) / c) + 1;
                    k++
                ) {
                    const px = (i + 0.5) * c;
                    const py = (j + 0.5) * c;
                    const pz = (k + 0.5) * c;
                    if (Math.hypot(px - x, py - y, pz - z) <= r)
                        this.grid.set(i, j, k, id);
                }
    }
}
