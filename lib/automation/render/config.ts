// Tunable constants for the Brasswork voxel renderer. Values marked "spec" are copied from the
// Nate-approved look in portfolio/automation-game/LOOK-SPEC.md. Values marked "placeholder" are
// ours until the design thread settles them (day and night keys, cycle length).

/** Terrain cell size and object (machine, prop) voxel size, in world units. Spec. */
export const TERRAIN_CELL = 0.2;
export const OBJECT_CELL = 0.1;
/** Cloud voxel size. Spec. */
export const CLOUD_CELL = 3.4;

/** Water plane height in world units. */
export const WATER_LEVEL = -1.3;

/** Half-size of the flat factory plateau (x and z). Spec: 18.4 x 12.4. */
export const PLATEAU_HALF_X = 9.2;
export const PLATEAU_HALF_Z = 6.2;

/** Block palette. Terrain uses the named ids; objects get ids from BLOCK_ID_BASE upward. */
export const BLOCK = {
    AIR: 0,
    SAND: 1,
    SAND_WET: 2,
    SAND_SHORE: 3,
    STONE: 4,
    STONE_DARK: 5,
    DIRT: 6,
    GRASS_A: 7,
    GRASS_B: 8,
    GRASS_C: 9,
    GRASS_D: 10,
    FLOOR_A: 11,
    FLOOR_B: 12,
    SKIRT: 13,
} as const;

export const BLOCK_ID_BASE = 32;

/** Terrain and plateau colours. Spec. */
export const TERRAIN_HEX: Record<number, number> = {
    [BLOCK.SAND]: 0xd9b97a,
    [BLOCK.SAND_WET]: 0xbf9f62,
    [BLOCK.SAND_SHORE]: 0xc9b676,
    [BLOCK.STONE]: 0x7a7068,
    [BLOCK.STONE_DARK]: 0x6b625a,
    [BLOCK.DIRT]: 0x6b4a2a,
    [BLOCK.GRASS_A]: 0x5f9440,
    [BLOCK.GRASS_B]: 0x6da345,
    [BLOCK.GRASS_C]: 0x4f8236,
    [BLOCK.GRASS_D]: 0x7bb04c,
    [BLOCK.FLOOR_A]: 0x6b5238,
    [BLOCK.FLOOR_B]: 0x7d6044,
    [BLOCK.SKIRT]: 0x7a5a38,
};

export const GRASS_HEX = [0x5f9440, 0x6da345, 0x4f8236, 0x7bb04c];

/** Water. Spec reference colour; the fix is still unapproved (see LOOK-SPEC.md). */
export const WATER_HEX = 0x2d7f9a;
export const WATER_OPACITY = 0.9;

/** Per-chunk quality knobs. The governor steps through these when frames run long. */
export interface QualityPreset {
    name: string;
    /** Pixel size of the scene render target in CSS pixels. Spec: 3 for the look. */
    pixelSize: number;
    /** Fraction of grass blades drawn. */
    grassDensity: number;
    /** Shadow casting from the sun. */
    shadows: boolean;
    /** Chunk meshes rebuilt per frame while the world is dirty. */
    rebuildsPerFrame: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
    {
        name: "low",
        pixelSize: 4,
        grassDensity: 0.35,
        shadows: false,
        rebuildsPerFrame: 2,
    },
    {
        name: "medium",
        pixelSize: 3,
        grassDensity: 0.7,
        shadows: true,
        rebuildsPerFrame: 4,
    },
    {
        name: "high",
        pixelSize: 3,
        grassDensity: 1,
        shadows: true,
        rebuildsPerFrame: 8,
    },
];

/** Lighting, sky and fog at one point of the day. t runs 0..1 and wraps. */
export interface TimeKey {
    t: number;
    sunColor: number;
    sunIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    /** Sky horizon also sets the fog colour. */
    fogColor: number;
    fogDensity: number;
    skyMid: number;
    skyTop: number;
    lampIntensity: number;
}

/** Dusk is the approved look (spec). Day and night are placeholders for the cycle. */
export const TIME_KEYS: TimeKey[] = [
    {
        t: 0,
        sunColor: 0xfff0d6,
        sunIntensity: 3.4,
        hemiSky: 0xfff1d8,
        hemiGround: 0x5a4028,
        hemiIntensity: 2.0,
        fogColor: 0xc9d6dc,
        fogDensity: 0.009,
        skyMid: 0x7fa0b8,
        skyTop: 0x2d5a8a,
        lampIntensity: 6,
    },
    {
        t: 0.5,
        sunColor: 0xffd9a0,
        sunIntensity: 4.2,
        hemiSky: 0xffe2b0,
        hemiGround: 0x4a2f18,
        hemiIntensity: 2.2,
        fogColor: 0xb87a4c,
        fogDensity: 0.0115,
        skyMid: 0xa9505a,
        skyTop: 0x241a4a,
        lampIntensity: 30,
    },
    {
        t: 0.75,
        sunColor: 0x6a7fb0,
        sunIntensity: 0.6,
        hemiSky: 0x3a4a6a,
        hemiGround: 0x1a1410,
        hemiIntensity: 0.8,
        fogColor: 0x1d2238,
        fogDensity: 0.02,
        skyMid: 0x2a2c4a,
        skyTop: 0x0a0a1e,
        lampIntensity: 40,
    },
    {
        t: 1,
        sunColor: 0xfff0d6,
        sunIntensity: 3.4,
        hemiSky: 0xfff1d8,
        hemiGround: 0x5a4028,
        hemiIntensity: 2.0,
        fogColor: 0xc9d6dc,
        fogDensity: 0.009,
        skyMid: 0x7fa0b8,
        skyTop: 0x2d5a8a,
        lampIntensity: 6,
    },
];

/** Light positions and the sun/sky direction. Spec. */
export const SUN_POSITION: [number, number, number] = [15, 9, -10];
/** Direction the sky dome draws the sun disc and rays from. Spec. */
export const SKY_SUN_DIR: [number, number, number] = [0.7, 0.075, -0.71];
export const FILL_LIGHT = {
    color: 0xff9d66,
    intensity: 1.7,
    position: [-14, 5, 17] as [number, number, number],
};
export const RIM_LIGHT = {
    color: 0xffd8a0,
    intensity: 1.2,
    position: [6, 7, -16] as [number, number, number],
};

/**
 * Furnace point lights, one above each smelter window. Spec: 0xff8a2a, intensity 30, distance 9.
 * These follow the smelter layout, which Simulation owns; update them if the layout moves.
 */
export const LAMP_POSITIONS: [number, number, number][] = [
    [-2.8, 1.3, -1.8],
    [-2.8, 1.3, 4.2],
];
export const LAMP_DISTANCE = 9;

/** Pacing of the day-night cycle when it runs, in seconds per full cycle (placeholder). */
export const DAY_LENGTH_SEC = 240;
