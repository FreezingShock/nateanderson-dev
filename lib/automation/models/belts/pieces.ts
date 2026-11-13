// The logistics kit, authored in voxels. Three-free so the tests run in plain Node.
//
// Every piece is built from code (no hand-placed voxel dumps), so tiers, mirrors and
// tweaks stay one-line changes. Coordinates are voxel indices inside the piece's
// footprint: i along x, j up, k along z. Flow is +z (rot 0).

import { Motion, VoxelSet, VOX } from "./vox";
import { PathId, RAMP_RISE, SLATS_PER_CELL, pathLen } from "./paths";
import { BELT_TIERS, C, type BeltTier } from "./palette";

export type PieceKind =
    | "straight"
    | "cornerL"
    | "cornerR"
    | "rampUp"
    | "rampDown"
    | "teeL"
    | "teeR"
    | "merger"
    | "splitter"
    | "undergroundIn"
    | "undergroundOut"
    | "portIn"
    | "portOut"
    | "capStart"
    | "capEnd"
    | "loader"
    | "unloader"
    | "crate"
    | "strongbox"
    | "dock";

export interface PieceDef {
    kind: PieceKind;
    name: string;
    /** Cells, before rotation. */
    footprint: { w: number; d: number };
    /** Paths items ride on, in the order the renderer should prefer. Empty for storage. */
    paths: number[];
    /** True when the piece changes colour and speed with the belt tier. */
    tiered: boolean;
    build: (tier: BeltTier) => VoxelSet;
}

// ---------- shared parts ----------

/** Belt cross-section by column (0..9 across). Returns the colour at layer j, or 0 for empty. */
function profile(c: number, j: number, t: BeltTier): number {
    if (c === 1 || c === 8) {
        if (j === 0) return C.steelD;
        if (j <= 2) return C.steel;
        if (j === 3) return t.trim;
        return 0;
    }
    if (c >= 2 && c <= 7) {
        if (j === 0) return C.steelD;
        if (j === 1) return C.belt;
    }
    return 0;
}

/** Moving slats along a path. One cull group per slat so they slide independently. */
function slats(s: VoxelSet, t: BeltTier, path: number, width = 6): void {
    const len = pathLen(path);
    const n = Math.round(len * SLATS_PER_CELL);
    const half = width / 2;
    for (let q = 0; q < n; q++) {
        const g = s.newGroup();
        const rest = ((q + 0.5) / SLATS_PER_CELL) % len;
        const color = q % 2 ? t.slatB : t.slatA;
        // Template: a bar `width` voxels across, 1 up, 1 along, centred across and along, sitting on y 0.
        for (let a = 0; a < width; a++) {
            const i = 5 - half + a;
            const edge = a === 0 || a === width - 1;
            s.put(i, 0, 0, edge ? t.trimD : color, {
                group: g,
                motion: Motion.Slat,
                slat: { path, rest, len, centre: [0.5, 0, 0.05] },
            });
        }
    }
}

/**
 * A vertical gear in the plane i = `plane`, spinning about x. Centre (y, z) in units,
 * radius in voxels. Top of the gear moves with the belt.
 */
function sideGear(s: VoxelSet, t: BeltTier, plane: number, cy: number, cz: number, rVox = 3, rateSign = 1): void {
    const g = s.newGroup();
    const r = rVox * VOX;
    const spin = { pivot: [(plane + 0.5) * VOX, cy, cz] as [number, number, number], axis: [1, 0, 0] as [number, number, number], rate: (rateSign * 1) / r };
    const j0 = Math.floor((cy - r) / VOX) - 1,
        j1 = Math.ceil((cy + r) / VOX);
    const k0 = Math.floor((cz - r) / VOX) - 1,
        k1 = Math.ceil((cz + r) / VOX);
    for (let j = j0; j <= j1; j++)
        for (let k = k0; k <= k1; k++) {
            if (j < 0) continue;
            const dy = (j + 0.5) * VOX - cy,
                dz = (k + 0.5) * VOX - cz;
            const d = Math.hypot(dy, dz) / VOX; // in voxels
            const ang = Math.atan2(dy, dz);
            let col = 0;
            if (d < 0.9) col = t.hub;
            else if (d < r / VOX - 0.9) col = Math.abs(dy) < 0.6 * VOX || Math.abs(dz) < 0.6 * VOX ? t.trimD : 0;
            else if (d < r / VOX) col = t.trim;
            else if (d < r / VOX + 0.75 && Math.cos(ang * 8) > 0.15) col = t.trimD;
            if (col) s.put(plane, j, k, col, { group: g, motion: Motion.Spin, spin });
        }
}

/** A horizontal gear lying flat, spinning about y. Centre in units, radius in voxels. */
function flatGear(s: VoxelSet, color: number, rim: number, cx: number, cz: number, j: number, rVox: number, rate = 2): void {
    const g = s.newGroup();
    const spin = { pivot: [cx, (j + 0.5) * VOX, cz] as [number, number, number], axis: [0, 1, 0] as [number, number, number], rate };
    const R = Math.ceil(rVox) + 1;
    for (let i = Math.floor(cx / VOX) - R; i <= Math.ceil(cx / VOX) + R; i++)
        for (let k = Math.floor(cz / VOX) - R; k <= Math.ceil(cz / VOX) + R; k++) {
            const dx = (i + 0.5) * VOX - cx,
                dz = (k + 0.5) * VOX - cz;
            const d = Math.hypot(dx, dz) / VOX;
            const ang = Math.atan2(dz, dx);
            let col = 0;
            if (d < 0.8) col = color;
            else if (d < rVox - 0.8) col = Math.abs(dx) < 0.6 * VOX || Math.abs(dz) < 0.6 * VOX ? rim : 0;
            else if (d < rVox) col = rim;
            else if (d < rVox + 0.8 && Math.cos(ang * 8) > 0.15) col = color;
            if (col) s.put(i, j, k, col, { group: g, motion: Motion.Spin, spin });
        }
}

/** Straight belt bed over k0..k1 with an optional vertical shift per k (ramps). */
function straightBed(s: VoxelSet, t: BeltTier, k0 = 0, k1 = 9, shift: (k: number) => number = () => 0): void {
    for (let k = k0; k <= k1; k++) {
        const sh = shift(k);
        for (let c = 1; c <= 8; c++) {
            for (let j = 0; j <= 3; j++) {
                const col = profile(c, j, t);
                if (col) s.put(c, j + sh, k, col);
            }
            // Side walls fill down to the ground under a raised bed.
            if ((c === 1 || c === 8) && sh > 0) for (let j = 0; j < sh; j++) s.put(c, j, k, j === 0 ? C.steelD : C.steel);
        }
        // Rail bolts every half cell so the joint between tiles reads.
        if (k === 0 || k === 5) {
            s.put(1, 3 + sh, k, t.trimD);
            s.put(8, 3 + sh, k, t.trimD);
        }
    }
}

/**
 * Style switches for taste calls. Change before the first geometry is built
 * (or call clearGeometryCache in kit.ts afterwards).
 */
export const BELT_STYLE = {
    /** A drive gear on every plain belt cell. Off: gears only on corners, junctions, ports and ends. */
    sideGears: false,
};

/** The drive gear a plain belt cell carries when BELT_STYLE.sideGears is on. */
function sideGears(s: VoxelSet, t: BeltTier): void {
    if (!BELT_STYLE.sideGears) return;
    // One drive gear on the left side, its top peeking over the rail.
    sideGear(s, t, 0, 0.3, 0.5, 3);
    // Axle boss on the far side.
    s.put(9, 2, 4, t.trimD);
    s.put(9, 2, 5, t.trimD);
}

// ---------- belts ----------

function buildStraight(t: BeltTier): VoxelSet {
    const s = new VoxelSet();
    straightBed(s, t);
    sideGears(s, t);
    slats(s, t, PathId.Straight);
    return s;
}

function buildCorner(t: BeltTier, left: boolean): VoxelSet {
    const s = new VoxelSet();
    // Arc centre at the cell corner on the feeding side.
    const cx = left ? 0 : 1,
        cz = 1;
    for (let i = 0; i < 10; i++)
        for (let k = 0; k < 10; k++) {
            const x = (i + 0.5) * VOX,
                z = (k + 0.5) * VOX;
            const r = Math.hypot(x - cx, z - cz);
            const c = Math.floor(r * 10);
            if (c < 1 || c > 8) continue;
            for (let j = 0; j <= 3; j++) {
                const col = profile(c, j, t);
                if (col) s.put(i, j, k, col);
            }
        }
    // A post with a flat gear in the empty outer corner: the corner's drive.
    const px = left ? 0.8 : 0.2,
        pz = 0.2;
    const pi = Math.floor(px / VOX),
        pk = Math.floor(pz / VOX);
    for (let j = 0; j <= 3; j++) {
        s.put(pi, j, pk, j === 0 ? C.steelD : C.steel);
        s.put(pi - 1, j, pk, j === 0 ? C.steelD : C.steel);
        s.put(pi, j, pk - 1, j === 0 ? C.steelD : C.steel);
        s.put(pi - 1, j, pk - 1, j === 0 ? C.steelD : C.steel);
    }
    flatGear(s, t.hub, t.trim, px, pz, 4, 2.2, left ? 4 : -4);
    slats(s, t, left ? PathId.CornerL : PathId.CornerR);
    return s;
}

function buildRamp(t: BeltTier, up: boolean): VoxelSet {
    const s = new VoxelSet();
    const steps = RAMP_RISE / VOX; // 5 voxels over the cell
    const shift = (k: number) => {
        const u = (k + 0.5) / 10;
        return Math.round((up ? u : 1 - u) * steps - 0.5 + 0.0001);
    };
    straightBed(s, t, 0, 9, shift);
    // Cross braces under the raised end.
    const hk = up ? 9 : 0;
    for (let c = 2; c <= 7; c++) for (let j = 0; j < shift(hk); j++) if ((c + j) % 3 === 0) s.put(c, j, hk, C.steelD);
    slats(s, t, up ? PathId.RampUp : PathId.RampDown);
    return s;
}

type Arms = { back: boolean; front: boolean; left: boolean; right: boolean };

/** Plus-shaped bed with frame around whichever arms are present. */
function junctionBed(s: VoxelSet, t: BeltTier, arms: Arms): void {
    const P = (i: number, k: number) => {
        if (i < 0 || i > 9 || k < 0 || k > 9) return false;
        const inZ = i >= 2 && i <= 7,
            inX = k >= 2 && k <= 7;
        if (inZ && inX) return true;
        if (inZ && k < 2) return arms.back;
        if (inZ && k > 7) return arms.front;
        if (inX && i < 2) return arms.left;
        if (inX && i > 7) return arms.right;
        return false;
    };
    for (let i = 0; i < 10; i++)
        for (let k = 0; k < 10; k++) {
            if (P(i, k)) {
                s.put(i, 0, k, C.steelD);
                s.put(i, 1, k, C.belt);
            } else if (P(i + 1, k) || P(i - 1, k) || P(i, k + 1) || P(i, k - 1)) {
                s.put(i, 0, k, C.steelD);
                s.put(i, 1, k, C.steel);
                s.put(i, 2, k, C.steel);
                s.put(i, 3, k, t.trim);
            }
        }
}

function buildTee(t: BeltTier, left: boolean): VoxelSet {
    const s = new VoxelSet();
    junctionBed(s, t, { back: true, front: true, left, right: !left });
    // Guide plate where the side feed meets the main belt.
    const gi = left ? 1 : 8;
    s.put(gi, 4, 1, t.trimD);
    s.put(gi, 4, 8, t.trimD);
    // Side gear on the closed side only.
    sideGear(s, t, left ? 9 : 0, 0.25, 0.5, 2);
    slats(s, t, PathId.Straight);
    slats(s, t, left ? PathId.FromLeft : PathId.FromRight, 4);
    return s;
}

/** Brass sorter housing over the junction centre with a gear on top. */
function sorterHousing(s: VoxelSet, t: BeltTier, body: number, cap: number, gearColor: number): void {
    for (let i = 2; i <= 7; i++)
        for (let k = 2; k <= 7; k++) {
            const corner = (i === 2 || i === 7) && (k === 2 || k === 7);
            const arch = (i >= 4 && i <= 5) || (k >= 4 && k <= 5);
            for (let j = 2; j <= 5; j++) {
                if (corner && j === 5) continue;
                // Arched openings low on each face so items visibly pass through.
                if (j <= 3 && arch && (i === 2 || i === 7 || k === 2 || k === 7)) continue;
                if (j <= 3 && i > 2 && i < 7 && k > 2 && k < 7) continue;
                s.put(i, j, k, j === 5 ? cap : body);
            }
        }
    for (let i = 3; i <= 6; i++) for (let k = 3; k <= 6; k++) s.put(i, 6, k, t.trimD);
    flatGear(s, gearColor, t.trim, 0.5, 0.5, 7, 2.6, 3);
}

function buildMerger(t: BeltTier): VoxelSet {
    const s = new VoxelSet();
    junctionBed(s, t, { back: true, front: true, left: true, right: true });
    sorterHousing(s, t, C.copper, C.copperD, C.steelD);
    slats(s, t, PathId.HalfIn);
    slats(s, t, PathId.FromLeft);
    slats(s, t, PathId.FromRight);
    slats(s, t, PathId.HalfOut);
    return s;
}

function buildSplitter(t: BeltTier): VoxelSet {
    const s = new VoxelSet();
    junctionBed(s, t, { back: true, front: true, left: true, right: true });
    sorterHousing(s, t, C.brassD, C.brass, C.copper);
    // Patina indicator lamps on the two side outlets.
    s.put(2, 6, 2, C.patina);
    s.put(7, 6, 7, C.patina);
    slats(s, t, PathId.HalfIn);
    slats(s, t, PathId.ToLeft);
    slats(s, t, PathId.ToRight);
    slats(s, t, PathId.HalfOut);
    return s;
}

/** Tunnel mouth. `exit` mirrors it so the belt comes up out of the ground. */
function buildUnderground(t: BeltTier, exit: boolean): VoxelSet {
    const s = new VoxelSet();
    const K = (k: number) => (exit ? 9 - k : k);
    straightBed(s, t, exit ? 5 : 0, exit ? 9 : 4);
    // Hood over the far half: an arched brass mouth with a dark throat.
    for (let k = 4; k <= 9; k++)
        for (let i = 1; i <= 8; i++)
            for (let j = 0; j <= 6; j++) {
                const inner = i >= 2 && i <= 7 && j >= 1 && j <= 4;
                const roundOff = (i === 1 || i === 8) && j === 6;
                if (roundOff) continue;
                if (inner) {
                    if (k >= 7) s.put(i, j, K(k), C.hole);
                    else if (j === 1) s.put(i, j, K(k), C.belt);
                    continue;
                }
                let col = k === 4 ? t.trim : j === 6 ? t.trimD : C.steel;
                if (j === 0) col = C.steelD;
                if (k === 4 && j === 5 && (i === 3 || i === 6)) col = t.trimD;
                s.put(i, j, K(k), col);
            }
    // Chevron plate on the roof: points down into the tunnel, cream on brass.
    s.put(4, 7, K(6), C.cream);
    s.put(5, 7, K(6), C.cream);
    s.put(3, 7, K(7), C.cream);
    s.put(6, 7, K(7), C.cream);
    // Crank gear on one side of the hood.
    sideGear(s, t, 9, 0.35, exit ? 0.3 : 0.7, 2);
    slats(s, t, exit ? PathId.HalfOut : PathId.HalfIn);
    return s;
}

/** Belt end that docks into a machine face. Input: machine is in front (+z). Output: machine is behind. */
function buildPort(t: BeltTier, input: boolean): VoxelSet {
    const s = new VoxelSet();
    const K = (k: number) => (input ? k : 9 - k);
    straightBed(s, t);
    // Collar against the machine: square frame with an opening the belt runs through.
    for (let k = 8; k <= 9; k++)
        for (let i = 0; i <= 9; i++)
            for (let j = 0; j <= 6; j++) {
                const open = i >= 2 && i <= 7 && j >= 1 && j <= 4;
                if (open) {
                    if (k === 9 && j >= 2) s.put(i, j, K(k), C.hole);
                    continue;
                }
                const edge = i === 0 || i === 9 || j === 6;
                s.put(i, j, K(k), k === 8 ? (edge ? t.trimD : t.trim) : C.steelD);
            }
    // Status lamp on top of the collar: amber for input, patina for output.
    s.put(4, 7, K(8), input ? C.glow : C.patina, { glow: input });
    s.put(5, 7, K(8), input ? C.glow : C.patina, { glow: input });
    // Hinged flap hanging at the mouth (input only): items push through it.
    if (input) for (let i = 2; i <= 7; i++) s.put(i, 4, K(7), C.copperD);
    sideGear(s, t, 0, 0.25, input ? 0.4 : 0.6, 2);
    slats(s, t, PathId.Straight);
    return s;
}

/** A belt with a drum roller at one end: where a line starts or stops with nothing attached. */
function buildCap(t: BeltTier, end: boolean): VoxelSet {
    const s = new VoxelSet();
    straightBed(s, t);
    sideGears(s, t);
    const k = end ? 9 : 0;
    // Drum roller across the belt end, spinning with the belt.
    const g = s.newGroup();
    const spin = { pivot: [0.5, 0.15, (k + 0.5) * VOX] as [number, number, number], axis: [1, 0, 0] as [number, number, number], rate: 1 / 0.15 };
    for (let i = 2; i <= 7; i++)
        for (let j = 0; j <= 2; j++) s.put(i, j, k, (i + j) % 2 ? t.trimD : C.steel, { group: g, motion: Motion.Spin, spin });
    // End plate with a bolt pattern.
    for (let i = 1; i <= 8; i++) s.put(i, 3, k, i === 1 || i === 8 ? t.trimD : t.trim);
    slats(s, t, PathId.Straight);
    return s;
}

/** Loader: belt in at the back, hopper and chute out the front into a crate or machine. */
function buildLoader(t: BeltTier, unload: boolean): VoxelSet {
    const s = new VoxelSet();
    const K = (k: number) => (unload ? 9 - k : k);
    straightBed(s, t, unload ? 5 : 0, unload ? 9 : 4);
    // Hopper body.
    for (let k = 4; k <= 9; k++)
        for (let i = 1; i <= 8; i++)
            for (let j = 0; j <= 7; j++) {
                const taper = j >= 5 ? 0 : 1; // wider mouth on top
                if ((i < 1 + taper || i > 8 - taper) && j < 5) continue;
                const inside = i >= 3 && i <= 6 && k >= 5 && k <= 8 && j >= 2;
                if (inside) {
                    if (j === 2) s.put(i, j, K(k), C.hole);
                    continue;
                }
                let col = j >= 6 ? t.trim : C.steel;
                if (j === 0) col = C.steelD;
                if (k === 9 && j >= 1 && j <= 4 && i >= 3 && i <= 6) col = C.hole;
                s.put(i, j, K(k), col);
            }
    // Spinning paddle wheel on the side that meters items through.
    sideGear(s, t, 0, 0.4, unload ? 0.35 : 0.65, 2);
    // Direction lamp.
    s.put(8, 8, K(9), unload ? C.patina : C.glow, { glow: !unload });
    slats(s, t, unload ? PathId.HalfOut : PathId.HalfIn);
    return s;
}

// ---------- storage ----------

function buildCrate(): VoxelSet {
    const s = new VoxelSet();
    for (let i = 1; i <= 8; i++)
        for (let k = 1; k <= 8; k++)
            for (let j = 0; j <= 6; j++) {
                const edgeI = i === 1 || i === 8,
                    edgeK = k === 1 || k === 8;
                let col: number = j % 2 ? C.wood : C.woodD;
                if ((edgeI && edgeK) || j === 0) col = C.woodDD;
                if (j === 3 && (edgeI || edgeK)) col = C.brassD; // iron band
                if ((edgeI && edgeK) && (j === 0 || j === 6)) col = C.brass; // corner brackets
                s.put(i, j, k, col);
            }
    // Lid with brass straps.
    for (let i = 1; i <= 8; i++) for (let k = 1; k <= 8; k++) s.put(i, 7, k, i === 3 || i === 6 ? C.brass : k % 2 ? C.wood : C.woodD);
    // Stencilled cog on the front face (+z, away from the loader), cream.
    const cog = ["0110", "1111", "1111", "0110"];
    const cog2 = ["1001", "0000", "0000", "1001"];
    for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) {
            if (cog[a][b] === "1" && !(a > 0 && a < 3 && b > 0 && b < 3)) s.put(3 + b, 5 - a, 9, C.cream);
            if (cog2[a][b] === "1") s.put(3 + b, 5 - a, 9, C.cream);
        }
    return s;
}

function buildStrongbox(): VoxelSet {
    const s = new VoxelSet();
    for (let i = 0; i <= 9; i++)
        for (let k = 1; k <= 8; k++)
            for (let j = 0; j <= 7; j++) {
                const edge = (i === 0 || i === 9) && (k === 1 || k === 8);
                let col: number = C.ironD;
                if (j === 0 || j === 7 || edge) col = C.steelD;
                if (!edge && (j === 2 || j === 5) && (i === 0 || i === 9 || k === 1 || k === 8)) col = C.iron; // ribs
                s.put(i, j, k, col);
            }
    // Rivets on the corners and a brass dial lock on the front.
    for (const [i, j] of [
        [1, 1],
        [8, 1],
        [1, 6],
        [8, 6],
    ])
        s.put(i, j, 9, C.brass);
    for (let i = 3; i <= 6; i++) for (let j = 2; j <= 5; j++) if (!((i === 3 || i === 6) && (j === 2 || j === 5))) s.put(i, j, 9, C.brassD);
    s.put(4, 4, 9, C.cream);
    s.put(5, 3, 9, C.cream);
    // Lid handle.
    for (let i = 3; i <= 6; i++) s.put(i, 8, 4, C.brass);
    s.put(3, 8, 5, C.brass);
    s.put(6, 8, 5, C.brass);
    return s;
}

/**
 * Delivery dock, 3 x 3 cells: milestone shipments leave from here. Three input
 * chutes on the back edge, a deck with stacked crates, a gantry crane with a
 * winch gear, and a dial whose hand turns while a shipment is filling.
 */
function buildDock(): VoxelSet {
    const s = new VoxelSet();
    const N = 30;
    // Deck: steel frame ring, plank surface.
    for (let i = 0; i < N; i++)
        for (let k = 0; k < N; k++) {
            const ring = i === 0 || k === 0 || i === N - 1 || k === N - 1;
            s.put(i, 0, k, C.steelD);
            s.put(i, 1, k, ring ? C.brassD : Math.floor(k / 3) % 2 ? C.wood : C.woodD);
            if (!ring && k % 3 === 0 && i % 6 === 2) s.put(i, 1, k, C.steelD); // nail heads
        }
    // Three input chutes along the back edge, one per cell.
    for (const ci of [5, 15, 25]) {
        for (let i = ci - 3; i <= ci + 2; i++)
            for (let k = 1; k <= 5; k++)
                for (let j = 2; j <= 6; j++) {
                    const inner = i > ci - 3 && i < ci + 2 && k > 1 && k < 5;
                    if (inner && j >= 3) {
                        if (j === 3) s.put(i, j, k, C.hole);
                        continue;
                    }
                    s.put(i, j, k, j >= 5 ? C.brass : C.steel);
                }
        // Collar facing the belt at the very back.
        for (let i = ci - 3; i <= ci + 2; i++) s.put(i, 7, 1, C.brassD);
        s.put(ci - 1, 7, 3, C.glow, { glow: true });
    }
    // Crate stack in the middle of the deck.
    const crate = (i0: number, j0: number, k0: number) => {
        for (let i = 0; i < 6; i++)
            for (let k = 0; k < 6; k++)
                for (let j = 0; j < 5; j++) {
                    const e = (i === 0 || i === 5) && (k === 0 || k === 5);
                    s.put(i0 + i, j0 + j, k0 + k, e ? C.woodDD : j === 2 ? C.brassD : j % 2 ? C.wood : C.woodD);
                }
    };
    crate(6, 2, 10);
    crate(12, 2, 10);
    crate(6, 2, 16);
    crate(9, 7, 13);
    // Gantry crane on the right edge: two posts, a top beam and a jib over the deck.
    for (const pk of [8, 22])
        for (let j = 2; j <= 19; j++)
            for (let i = 26; i <= 27; i++)
                for (let k = pk; k <= pk + 1; k++) s.put(i, j, k, j % 4 === 0 ? C.brassD : C.brass);
    for (let k = 8; k <= 23; k++) for (let i = 26; i <= 27; i++) for (let j = 20; j <= 21; j++) s.put(i, j, k, j === 21 ? C.brass : C.brassD);
    for (let i = 10; i <= 27; i++) for (let k = 15; k <= 16; k++) s.put(i, 20, k, i % 3 === 0 ? C.steelD : C.steel);
    // Hook cable and a crate on the hook.
    for (let j = 12; j <= 19; j++) s.put(13, j, 15, C.steelD);
    for (let i = 11; i <= 15; i++) for (let k = 13; k <= 17; k++) for (let j = 8; j <= 11; j++) s.put(i, j, k, j === 10 ? C.brassD : (i + j) % 2 ? C.wood : C.woodD);
    // Winch: a big gear on the outer face of the crane, turning slowly.
    {
        const g = s.newGroup();
        const cy = 1.4,
            cz = 1.55,
            r = 4;
        const spin = { pivot: [2.85, cy, cz] as [number, number, number], axis: [1, 0, 0] as [number, number, number], rate: 0.6 };
        for (let j = 9; j <= 19; j++)
            for (let k = 10; k <= 21; k++) {
                const dy = (j + 0.5) * VOX - cy,
                    dz = (k + 0.5) * VOX - cz;
                const d = Math.hypot(dy, dz) / VOX;
                const a = Math.atan2(dy, dz);
                let col = 0;
                if (d < 1) col = C.steelD;
                else if (d < r - 1) col = Math.abs(dy) < 0.06 || Math.abs(dz) < 0.06 ? C.brassD : 0;
                else if (d < r) col = C.brass;
                else if (d < r + 0.9 && Math.cos(a * 10) > 0.1) col = C.brassD;
                if (col) s.put(28, j, k, col, { group: g, motion: Motion.Spin, spin });
            }
    }
    // Lamp on top of the crane.
    s.put(26, 22, 15, C.glow, { glow: true });
    s.put(27, 22, 16, C.glow, { glow: true });
    // Shipment dial on a post at the front-left corner, facing +z (out of the dock).
    for (let j = 2; j <= 10; j++) for (let i = 3; i <= 4; i++) s.put(i, j, 26, C.steel);
    {
        const cx = 0.4,
            cy = 1.45,
            r = 3.6;
        for (let i = 0; i <= 8; i++)
            for (let j = 10; j <= 19; j++) {
                const d = Math.hypot((i + 0.5) * VOX - cx, (j + 0.5) * VOX - cy) / VOX;
                if (d < r) s.put(i, j, 27, C.cream);
                else if (d < r + 1) s.put(i, j, 27, C.brass);
                if (d < r + 1) s.put(i, j, 26, C.brassD);
            }
        // Tick marks.
        for (let q = 0; q < 8; q++) {
            const a = (q / 8) * Math.PI * 2;
            const i = Math.floor((cx + Math.cos(a) * 0.3) / VOX),
                j = Math.floor((cy + Math.sin(a) * 0.3) / VOX);
            s.put(i, j, 28, C.steelD);
        }
        // The hand: turns about z. A quarter turn per 10 cells of belt travel.
        const g = s.newGroup();
        const spin = { pivot: [cx, cy, 2.85] as [number, number, number], axis: [0, 0, -1] as [number, number, number], rate: 0.157 };
        for (let q = 0; q <= 2; q++) s.put(Math.floor(cx / VOX), Math.floor(cy / VOX) + q, 28, q === 2 ? C.copper : C.copperD, { group: g, motion: Motion.Spin, spin });
        s.put(Math.floor(cx / VOX), Math.floor(cy / VOX), 28, C.steelD);
    }
    // Bollards on the front edge.
    for (const bi of [10, 20])
        for (let j = 2; j <= 4; j++) {
            s.put(bi, j, 27, j === 4 ? C.brass : C.steelD);
            s.put(bi + 1, j, 27, j === 4 ? C.brass : C.steelD);
        }
    return s;
}

// ---------- registry ----------

const def = (kind: PieceKind, name: string, paths: number[], build: (t: BeltTier) => VoxelSet, extra: Partial<PieceDef> = {}): PieceDef => ({
    kind,
    name,
    footprint: { w: 1, d: 1 },
    paths,
    tiered: true,
    build,
    ...extra,
});

export const PIECES: Record<PieceKind, PieceDef> = {
    straight: def("straight", "Belt", [PathId.Straight], buildStraight),
    cornerL: def("cornerL", "Belt corner (fed from the left)", [PathId.CornerL], (t) => buildCorner(t, true)),
    cornerR: def("cornerR", "Belt corner (fed from the right)", [PathId.CornerR], (t) => buildCorner(t, false)),
    rampUp: def("rampUp", "Belt ramp up", [PathId.RampUp], (t) => buildRamp(t, true)),
    rampDown: def("rampDown", "Belt ramp down", [PathId.RampDown], (t) => buildRamp(t, false)),
    teeL: def("teeL", "Belt with a side feed from the left", [PathId.Straight, PathId.FromLeft], (t) => buildTee(t, true)),
    teeR: def("teeR", "Belt with a side feed from the right", [PathId.Straight, PathId.FromRight], (t) => buildTee(t, false)),
    merger: def("merger", "Merger", [PathId.HalfIn, PathId.FromLeft, PathId.FromRight, PathId.HalfOut], buildMerger),
    splitter: def("splitter", "Splitter", [PathId.HalfIn, PathId.HalfOut, PathId.ToLeft, PathId.ToRight], buildSplitter),
    undergroundIn: def("undergroundIn", "Tunnel entrance", [PathId.HalfIn], (t) => buildUnderground(t, false)),
    undergroundOut: def("undergroundOut", "Tunnel exit", [PathId.HalfOut], (t) => buildUnderground(t, true)),
    portIn: def("portIn", "Machine input port", [PathId.Straight], (t) => buildPort(t, true)),
    portOut: def("portOut", "Machine output port", [PathId.Straight], (t) => buildPort(t, false)),
    capStart: def("capStart", "Belt start", [PathId.Straight], (t) => buildCap(t, false)),
    capEnd: def("capEnd", "Belt end", [PathId.Straight], (t) => buildCap(t, true)),
    loader: def("loader", "Loader", [PathId.HalfIn], (t) => buildLoader(t, false)),
    unloader: def("unloader", "Unloader", [PathId.HalfOut], (t) => buildLoader(t, true)),
    crate: def("crate", "Storage crate", [], buildCrate, { tiered: false }),
    strongbox: def("strongbox", "Strongbox", [], buildStrongbox, { tiered: false }),
    dock: def("dock", "Delivery dock", [], buildDock, { tiered: false, footprint: { w: 3, d: 3 } }),
};

export const PIECE_KINDS = Object.keys(PIECES) as PieceKind[];

/** Build a piece's voxels for a tier (non-tiered pieces ignore the tier). */
export function buildPiece(kind: PieceKind, tier = 0): VoxelSet {
    const p = PIECES[kind];
    return p.build(BELT_TIERS[p.tiered ? tier : 0]);
}
