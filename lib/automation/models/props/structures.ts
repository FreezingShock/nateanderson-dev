// The workshop's own non-machine structures: the starting workshop building,
// lamp posts, fences, walls, path tiles and yard clutter.
import { BUILD, LOOK, STONE, WOOD } from "./palette";
import { Vox, hash3, mix, noise3, rng, type PropModel, type Vec3 } from "./vox";

const V = 0.1;
/** Voxel units to world units relative to the base centre. */
const w = (i: number, j: number, k: number): Vec3 => [i * V, j * V, k * V];

/** Stone blocks with mortar, rows offset like real masonry. */
function masonry(seed: number, a: number = BUILD.stone, b: number = BUILD.stoneD) {
    return (i: number, j: number, k: number) => {
        const row = Math.floor(j / 2);
        const u = (i + k) + (row % 2) * 2;
        if (j % 2 === 1 && hash3(i, j, k, seed) < 0.15) return mix(a, 0x3a3028, 0.45);
        if (((u % 4) + 4) % 4 === 0) return mix(b, 0x3a3028, 0.35);
        return hash3(Math.floor(u / 4), row, 0, seed) < 0.5 ? a : mix(a, b, 0.5 + hash3(Math.floor(u / 4), row, 1, seed) * 0.5);
    };
}

function planks(dir: "x" | "z", a: number = WOOD.plank, b: number = WOOD.plankD, seed = 0) {
    return (i: number, j: number, k: number) => {
        const n = dir === "x" ? k : i;
        const board = Math.floor(n / 2);
        if (((n % 2) + 2) % 2 === 0 && hash3(i, j, k, seed) < 0.3) return mix(b, 0x2a1a10, 0.3);
        return hash3(board, 0, 0, seed + 3) < 0.4 ? a : mix(a, b, 0.6);
    };
}

/**
 * Starting workshop: stone footing, half-timbered walls, patina copper roof,
 * a clock in the front gable, brass double doors, lit windows and a chimney.
 * Footprint 3 x 3 cells (30 x 26 voxels plus overhang); the door faces +z.
 */
export function workshop(seed = 1): PropModel {
    const v = new Vox(`build.workshop.${seed}`);
    const X = 15, Z = 13, WALL = 26, OVER = 2;
    const stone = masonry(seed);
    // Footing and floor.
    v.box(-X - 1, -8, -Z - 1, X + 1, 4, Z + 1, stone); // footing runs below grade so it sits into slopes
    v.box(-4, -4, Z + 1, 4, 2, Z + 3, masonry(seed + 1, STONE.c, STONE.a)); // front step
    v.box(-4, -4, Z + 3, 4, 1, Z + 5, masonry(seed + 2, STONE.c, STONE.a));
    // Walls: plaster panels with timber frame.
    const wall = (i: number, j: number, k: number) => {
        const edgeX = Math.abs(i) >= X - 1, edgeZ = Math.abs(k) >= Z - 1;
        const corner = edgeX && edgeZ;
        const rail = j === 4 || j === 5 || j === 15 || j >= WALL - 2;
        const along = edgeZ ? i : k;
        const post = ((along % 7) + 7) % 7 === 0;
        const brace = edgeZ ? Math.abs(((i % 14) + 14) % 14 - (j - 5)) <= 0 && j > 5 && j < 15 : Math.abs(((k % 14) + 14) % 14 - (j - 5)) <= 0 && j > 5 && j < 15;
        if (corner || rail || post || brace) return hash3(i, j, k, seed) < 0.2 ? mix(BUILD.timber, 0x000000, 0.2) : BUILD.timber;
        return noise3(i * 0.3, j * 0.3, k * 0.3, seed) > 0.68 ? BUILD.plasterD : BUILD.plaster;
    };
    for (let j = 4; j < WALL; j++)
        for (let i = -X; i < X; i++)
            for (let k = -Z; k < Z; k++)
                if (i <= -X + 1 || i >= X - 2 || k <= -Z + 1 || k >= Z - 2) v.set(i, j, k, wall);
    // Gables (front and back) follow the roof slope.
    const roofY = (x: number) => WALL + (X + OVER - Math.abs(x + 0.5)) * 0.72;
    for (let i = -X; i < X; i++)
        for (let j = WALL; j < roofY(i) - 1; j++)
            for (const k of [-Z, -Z + 1, Z - 2, Z - 1]) v.set(i, j, k, (ii, jj, kk) => (Math.abs(ii + 0.5) < 1.5 && jj > WALL + 2 ? BUILD.timber : wall(ii, Math.min(jj, WALL - 3), kk)));
    // Roof: two patina slopes with standing seams and a lighter ridge cap.
    for (let i = -X - OVER; i < X + OVER; i++)
        for (let k = -Z - OVER; k < Z + OVER; k++) {
            const y = Math.floor(roofY(i));
            const seam = ((k % 3) + 3) % 3 === 0;
            const weathered = noise3(i * 0.2, 0, k * 0.2, seed + 4) > 0.62;
            const c = Math.abs(i + 0.5) < 1.5 ? BUILD.roofL : seam ? BUILD.roofD : weathered ? mix(BUILD.roof, LOOK.copper, 0.35) : BUILD.roof;
            v.set(i, y, k, c);
            v.set(i, y - 1, k, BUILD.roofD);
        }
    // Chimney on the back left, brick with a stone cap.
    const brick = (i: number, j: number, k: number) => ((j % 2 === 0 && ((i + k + (j >> 1)) % 3 === 0)) ? BUILD.brickD : hash3(i, j, k, seed) < 0.12 ? mix(BUILD.brick, 0x3a2018, 0.3) : BUILD.brick);
    v.box(-10, 20, -8, -6, 44, -4, brick);
    v.box(-11, 44, -9, -5, 46, -3, masonry(seed + 2));
    v.box(-9, 45, -7, -7, 46, -5, 0x1c140c);
    // Front double door with brass straps.
    const door = (i: number, j: number, k: number) => {
        if (j === 7 || j === 13) return LOOK.brass;
        if (Math.abs(i + 0.5) < 0.6) return BUILD.timber;
        return planks("z", BUILD.door, BUILD.doorD, seed)(i, j, k);
    };
    for (let i = -4; i < 4; i++) for (let j = 4; j < 17; j++) { v.del(i, j, Z - 2); v.set(i, j, Z - 1, door); }
    for (let i = -5; i < 5; i++) v.set(i, 17, Z - 1, BUILD.timber), v.set(i, 17, Z, BUILD.timber);
    v.set(-2, 10, Z, LOOK.brass); v.set(1, 10, Z, LOOK.brass); // handles
    // Clock in the front gable: brass bezel, cream face, hour marks and hands.
    const cy = WALL + 6.5, cr = 5.5;
    for (let i = -7; i <= 7; i++)
        for (let j = Math.floor(cy - 7); j <= cy + 7; j++) {
            const d = Math.hypot(i + 0.5, j + 0.5 - cy);
            if (d > cr) continue;
            v.set(i, j, Z, d > cr - 1 ? 0x5a3a18 : d > cr - 2 ? LOOK.brass : BUILD.plaster);
            if (d <= cr - 1) v.del(i, j, Z + 1);
        }
    for (let n = 0; n < 12; n++) {
        const a = (n / 12) * Math.PI * 2;
        v.set(Math.cos(a) * 2.9 - 0.5 + 0.5, cy + Math.sin(a) * 2.9, Z + 1, n % 3 === 0 ? 0x2a2018 : 0x8a6a48);
    }
    v.line([0, cy, Z + 1], [0, cy + 3.2, Z + 1], 0.3, 0.3, 0x2a2018); // minute hand
    v.line([0, cy, Z + 1], [2, cy - 1, Z + 1], 0.3, 0.3, 0x2a2018); // hour hand
    v.set(0, cy, Z + 1, LOOK.brass);
    // Windows: lit panes, timber cross and a sill. Front pair plus sides.
    const win = (cx: number, cz: number, axis: "x" | "z") => {
        for (let a = -2; a < 2; a++)
            for (let j = 8; j < 14; j++) {
                const mull = a === -1 && false;
                const cross = j === 11 || a === 0;
                const [i, k] = axis === "z" ? [cx + a, cz] : [cx, cz + a];
                const out = axis === "z" ? [i, k + Math.sign(cz)] : [i + Math.sign(cx), k];
                v.del(i, j, k);
                if (axis === "z") v.del(i, j, k - Math.sign(cz)); else v.del(i - Math.sign(cx), j, k);
                v.set(out[0], j, out[1], cross || mull ? BUILD.timber : BUILD.window, { glow: !(cross || mull) });
            }
        for (let a = -3; a < 3; a++) {
            const [i, k] = axis === "z" ? [cx + a, cz + Math.sign(cz) * 2] : [cx + Math.sign(cx) * 2, cz + a];
            v.set(i, 7, k, BUILD.stone);
            const [ti, tk] = axis === "z" ? [cx + a, cz + Math.sign(cz)] : [cx + Math.sign(cx), cz + a];
            v.set(ti, 14, tk, BUILD.timber);
        }
    };
    win(-9, Z - 1, "z"); win(9, Z - 1, "z");
    win(X - 1, -6, "x"); win(X - 1, 5, "x"); win(-X, -6, "x"); win(-X, 5, "x");
    // Wall lantern by the door.
    v.box(5, 12, Z, 6, 13, Z + 2, 0x2a2420);
    v.box(5, 9, Z + 1, 7, 12, Z + 3, LOOK.brass);
    v.set(5, 10, Z + 2, 0xffd070, { glow: true }); v.set(6, 10, Z + 2, 0xffd070, { glow: true }); v.set(5, 11, Z + 2, 0xffd070, { glow: true }); v.set(6, 11, Z + 2, 0xffd070, { glow: true });
    // Brass gear weather vane on the ridge.
    const gy = Math.floor(roofY(0)) + 1;
    v.box(0, gy, -Z + 2, 1, gy + 4, -Z + 3, 0x3a3128);
    for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2, r = a % 2 ? 2.2 : 3;
        v.set(Math.cos(ang) * r, gy + 6 + Math.sin(ang) * r, -Z + 2, LOOK.brass);
    }
    // Yard clutter on the side: rain barrel and crates.
    v.cyl(X + 3, 8, 0, 6, 2, (_i, j) => (j === 1 || j === 4 ? 0x3a3128 : WOOD.plank));
    v.box(X + 1, 0, -10, X + 5, 4, -6, (i, j, k) => ((i + k) % 4 === 0 || j === 0 || j === 3 ? WOOD.plankD : WOOD.plankL));
    v.box(X + 2, 4, -9, X + 5, 7, -6, (i, j, k) => ((i + k) % 3 === 0 || j === 6 ? WOOD.plankD : WOOD.plankL));
    return v.build({
        ao: 0.45, jitter: 0.05,
        anchors: { light: w(6, 10.5, Z + 3), door: w(0, 0, Z + 3), chimney: w(-8, 46, -6) },
    });
}

/** Lamp posts: 0 classic post lantern, 1 crook arm with a hanging lantern, 2 double arm. */
export function lamp(style = 0): PropModel {
    const v = new Vox(`build.lamp.${style}`);
    const iron = 0x2e2824, ironL = 0x4a3f36;
    const H = style === 0 ? 20 : 24;
    v.box(-2, -3, -2, 2, 2, 2, (i, j, k) => (j === 1 && (Math.abs(i + 0.5) > 1 || Math.abs(k + 0.5) > 1) ? ironL : iron));
    v.box(-1, 2, -1, 1, H, 1, iron);
    for (const j of [3, H - 4]) v.box(-2, j, -2, 2, j + 1, 2, LOOK.brass);
    const lantern = (cx: number, by: number, cz: number) => {
        // Brass cage, glowing glass, steel cap and finial.
        for (let i = -2; i <= 2; i++) for (let k = -2; k <= 2; k++) for (let j = 0; j < 6; j++) {
            const edge = (Math.abs(i) === 2 ? 1 : 0) + (Math.abs(k) === 2 ? 1 : 0) + (j === 0 || j === 5 ? 1 : 0);
            if (edge >= 2) v.set(cx + i, by + j, cz + k, LOOK.brass);
            else if (Math.abs(i) <= 1 && Math.abs(k) <= 1 && j > 0 && j < 5) v.set(cx + i, by + j, cz + k, 0xffd070, { glow: true });
        }
        v.box(cx - 3, by + 6, cz - 3, cx + 4, by + 7, cz + 4, 0x3a3128);
        v.box(cx - 2, by + 7, cz - 2, cx + 3, by + 8, cz + 3, 0x3a3128);
        v.set(cx, by + 8, cz, LOOK.brass); v.set(cx, by + 9, cz, LOOK.brass);
    };
    let light: Vec3;
    if (style === 0) {
        lantern(0, H, 0);
        light = w(0.5, H + 3, 0.5);
    } else if (style === 1) {
        // Shepherd's crook arm with a hanging lantern.
        v.line([0, H - 1, 0], [3, H + 3, 0], 0.6, 0.6, iron);
        v.line([3, H + 3, 0], [7, H + 2, 0], 0.6, 0.6, iron);
        v.set(7, H + 1, 0, iron);
        lantern(7, H - 8, 0);
        light = w(7.5, H - 5, 0.5);
        // A little brass scroll under the arm.
        v.set(2, H - 2, 0, LOOK.brass); v.set(3, H - 1, 0, LOOK.brass);
    } else {
        v.box(-7, H - 2, 0, 8, H - 1, 1, iron);
        lantern(-6, H - 10, 0); lantern(7, H - 10, 0);
        v.set(-6, H - 3, 0, iron); v.set(7, H - 3, 0, iron);
        light = w(0.5, H - 7, 0.5);
        lantern(0, H, 0);
    }
    return v.build({ ao: 0.2, jitter: 0.04, anchors: { light } });
}

/** Fence pieces, one grid cell long along x. kind: straight, corner, end, gate. */
export function fence(kind: "straight" | "corner" | "end" | "gate" = "straight", seed = 1): PropModel {
    const v = new Vox(`build.fence.${kind}.${seed}`);
    const wood = (i: number, j: number, k: number) => (hash3(i, j, k, seed) < 0.18 ? WOOD.plankD : noise3(i * 0.4, j * 0.4, k * 0.4, seed) > 0.6 ? 0x9a7a58 : WOOD.post);
    const post = (x: number, z: number) => { v.box(x, 0, z, x + 2, 10, z + 2, wood); v.box(x, 10, z, x + 2, 11, z + 2, WOOD.plankD); };
    if (kind === "gate") {
        post(-6, -1); post(4, -1);
        for (let i = -4; i < 4; i++) for (let j = 1; j < 9; j++) if (j === 2 || j === 7 || i === -4 || i === 3 || Math.abs((i + 4) - (j - 1)) < 1) v.set(i, j, 0, wood);
        v.set(2, 5, 1, LOOK.brass); v.set(-4, 3, 1, 0x2e2824); v.set(-4, 6, 1, 0x2e2824);
    } else {
        post(-5, -1);
        if (kind !== "end") {
            for (const j of [4, 7]) v.box(-3, j, 0, 5, j + 1, 1, wood);
            if (kind === "corner") for (const j of [4, 7]) v.box(-5, j, 1, -4, j + 1, 5, wood);
        }
    }
    return v.build({ ao: 0.3 });
}

/** Dry-stone wall, one grid cell long along x, mossy top. */
export function stoneWall(seed = 1): PropModel {
    const R = rng(seed * 83 + 7);
    const v = new Vox(`build.stonewall.${seed}`);
    for (let j = 0; j < 6; j++) {
        let i = -5 - (j % 2);
        while (i < 5) {
            const len = 2 + Math.floor(R() * 3);
            const c = [STONE.a, STONE.b, STONE.c, STONE.d, STONE.light][Math.floor(R() * 5)];
            const inset = R() < 0.3 ? 1 : 0;
            v.box(Math.max(i, -5), j, -2 + inset * (j > 3 ? 1 : 0), Math.min(i + len, 5), j + 1, 2, j === 5 && R() < 0.6 ? (R() < 0.5 ? STONE.moss : STONE.mossD) : c);
            i += len;
        }
    }
    return v.build({ ao: 0.4 });
}

/** Path tiles, one grid cell square, top surface at y = 0.1. kind: cobble, gravel, planks, steps, dirt. */
export function path(kind: "cobble" | "gravel" | "planks" | "steps" | "dirt" = "cobble", seed = 1): PropModel {
    const R = rng(seed * 89 + 2);
    const v = new Vox(`build.path.${kind}.${seed}`);
    const dirt = (i: number, j: number, k: number) => (hash3(i, j, k, seed) < 0.3 ? 0x5a3e24 : LOOK.dirt);
    if (kind === "cobble") {
        v.box(-5, 0, -5, 5, 1, 5, dirt);
        // Rounded cobbles of 2 to 3 voxels, gaps show the dirt.
        for (let i = -5; i < 5; i += 3) for (let k = -5 + (Math.floor(i / 3) % 2 ? 1 : 0); k < 5; k += 3) {
            const c = [STONE.a, STONE.c, STONE.light, STONE.b][Math.floor(R() * 4)];
            v.box(i, 0, k, Math.min(i + 2, 5), 2, Math.min(k + 2, 5), (ii, jj, kk) => (jj === 1 ? mix(c, 0xffffff, 0.08) : c));
            if (R() < 0.3) v.del(i, 1, k);
        }
    } else if (kind === "gravel") {
        v.box(-5, 0, -5, 5, 1, 5, (i, j, k) => [0x9a8e80, 0x8a7e70, 0xa89c8c, 0x7a7068, LOOK.dirt][Math.floor(hash3(i, j, k, seed) * 5)]);
        for (let n = 0; n < 8; n++) v.set(Math.floor(R() * 10) - 5, 1, Math.floor(R() * 10) - 5, STONE.light);
    } else if (kind === "planks") {
        v.box(-5, 0, -5, 5, 1, 5, planks("x", WOOD.plank, WOOD.plankD, seed));
        for (const k of [-5, 4]) v.box(-5, -1, k, 5, 0, k + 1, WOOD.beam);
        v.set(-4, 1, -4, 0x2e2824); v.set(3, 1, 3, 0x2e2824);
    } else if (kind === "steps") {
        for (let n = 0; n < 2; n++) {
            const cx = (n - 0.5) * 5 + (R() - 0.5) * 2, cz = (R() - 0.5) * 3;
            v.ellipsoid(cx, 0, cz, 2.3, 1, 2, (i, j, k) => (j >= 0 ? mix(STONE.c, STONE.light, hash3(i, j, k, seed) * 0.6) : STONE.a), 0.15, seed + n);
        }
        const below: [number, number, number][] = [];
        v.forEach((i, j, k) => { if (j < 0) below.push([i, j, k]); });
        for (const [i, j, k] of below) v.del(i, j, k);
    } else {
        v.box(-5, 0, -5, 5, 1, 5, (i, j, k) => (Math.abs(k) > 3 && hash3(i, j, k, seed) < 0.5 ? LOOK.grass[Math.floor(hash3(k, i, j, seed) * 4)] : dirt(i, j, k)));
    }
    return v.build({ ao: 0.2, lod: false });
}

/** Yard clutter: crate, barrel, sign, bench, woodpile, anvil. */
export function yard(kind: "crate" | "barrel" | "sign" | "bench" | "woodpile" | "anvil", seed = 1): PropModel {
    const R = rng(seed * 97 + 1);
    const v = new Vox(`build.yard.${kind}.${seed}`);
    if (kind === "crate") {
        const s = 3 + Math.floor(R() * 2);
        v.box(-s, 0, -s, s, s * 2, s, (i, j, k) => (Math.abs(i + 0.5) > s - 1 && Math.abs(k + 0.5) > s - 1 || j === 0 || j === s * 2 - 1 || Math.abs(Math.abs(i + 0.5) - Math.abs(j - s + 0.5)) < 0.6 ? WOOD.plankD : WOOD.plankL));
        if (R() < 0.6) v.box(-s + 1, s * 2, -s + 1, s - 1, s * 2 + 3, s - 1, (i, j, k) => (j === s * 2 + 2 || (i + k) % 4 === 0 ? WOOD.plankD : WOOD.plank));
    } else if (kind === "barrel") {
        for (let j = 0; j < 9; j++) {
            const r = 2.6 + Math.sin((j / 8) * Math.PI) * 0.7;
            v.cyl(0, 0, j, j + 1, r, (i, jj, k) => (jj === 1 || jj === 7 ? 0x3a3128 : (Math.round(Math.atan2(k, i) * 3) % 2 ? WOOD.plank : WOOD.plankD)));
        }
        v.cyl(0, 0, 9, 10, 2.4, WOOD.plankD);
    } else if (kind === "sign") {
        v.box(0, 0, 0, 1, 16, 1, WOOD.post);
        const boards: [number, number][] = [[13, 1], [10, -1]];
        for (const [y, dir] of boards) {
            v.box(dir > 0 ? 1 : -6, y, -0, dir > 0 ? 7 : 0, y + 2, 1, planks("z", WOOD.plankL, WOOD.plank, seed));
            v.set(dir > 0 ? 7 : -7, y, 0, WOOD.plankL); v.set(dir > 0 ? 7 : -7, y + 1, 0, WOOD.plankL);
            v.set(dir > 0 ? 3 : -3, y + 1, 1, 0x2a2018); v.set(dir > 0 ? 4 : -4, y, 1, 0x2a2018);
        }
    } else if (kind === "bench") {
        for (const x of [-6, 5]) v.box(x, 0, -1, x + 1, 4, 2, 0x2e2824);
        v.box(-7, 4, -2, 7, 5, 2, planks("x", WOOD.plankL, WOOD.plank, seed));
        v.box(-7, 5, 2, 7, 8, 3, planks("x", WOOD.plankL, WOOD.plank, seed));
        for (const x of [-6, 5]) v.box(x, 5, 2, x + 1, 9, 3, 0x2e2824);
    } else if (kind === "woodpile") {
        for (let j = 0; j < 3; j++) for (let n = -2 + (j % 2) * 0.5; n < 2 - j * 0.5; n++) {
            const z = n * 2.4;
            v.line([-5, 1 + j * 2, z], [5, 1 + j * 2, z], 1.1, 1.1, (i, jj, k) => (i <= -5 || i >= 4 ? (Math.hypot(jj - 1 - j * 2, k - z) < 0.6 ? 0xc89a68 : 0xb08050) : WOOD.post));
        }
        v.cyl(8, 0, 0, 3, 2, WOOD.post);
        v.line([8, 3, 0], [9, 7, 1], 0.4, 0.4, WOOD.plankL);
        v.box(8, 6, 1, 10, 7, 2, 0x7f8ca3);
    } else {
        v.cyl(0, 0, 0, 5, 2.6, (i, j, k) => (j === 4 ? 0xc89a68 : WOOD.post));
        v.box(-3, 5, -1, 3, 6, 2, 0x3a3634);
        v.box(-2, 6, -1, 2, 7, 2, 0x4a4644);
        v.box(-4, 7, -2, 4, 9, 2, (i, j) => (j === 8 ? 0x6a6664 : 0x4a4644));
        v.box(4, 8, -1, 6, 9, 1, 0x4a4644);
    }
    return v.build({ ao: 0.35 });
}

export const STRUCTURES = {
    workshop, lamp, fence, stoneWall, path, yard,
} as const;
