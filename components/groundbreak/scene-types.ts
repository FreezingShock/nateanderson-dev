// The contract between the game screen and the site scene. The screen owns input and the camera (wheel, pinch, drag, keys,
// reset) and passes the result down. A scene component draws one site view and nothing else: no panels, no buttons.
// components/groundbreak-art can supply a richer one with the same props.

/** World units are art pixels. The site is WORLD_W by WORLD_H; the ground line sits at GROUND_Y. */
export const WORLD_W = 480;
export const WORLD_H = 270;
export const GROUND_Y = 214;

export interface Camera {
    /** World point shown at the centre of the screen. */
    x: number;
    y: number;
    /** 1 fits the whole site to the screen (cover). 0.5 to 5 is the allowed range. */
    z: number;
}
export const CAMERA_HOME: Camera = { x: WORLD_W / 2, y: 140, z: 1 };
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 5;

export interface SceneJob {
    id: string;
    floors: number;
    /** Whole-job progress, 0 to 1 (phases weighted equally). */
    frac: number;
    /** Index of the phase being built and its name, for art that draws phase specific detail. */
    phase: number;
    phaseName: string;
    phaseCount: number;
    /** True once every phase is done and the inspection timer runs. 0 to 1 while inspecting. */
    inspecting: boolean;
    inspect: number;
    /** Floors topped out so far (floor-by-floor rise), and whether the job is still in its permit wait. */
    floorsUp?: number;
    permit?: boolean;
}
export interface SceneBuilding { id: string; firm: number; index: number }

export interface SceneProps {
    camera: Camera;
    job: SceneJob | null;
    /** Every finished building across all runs, oldest first. The skyline grows with it. */
    skyline: SceneBuilding[];
    /** Equipment level of the tower crane, to dress the crane up. */
    craneLevel: number;
    /** Honour reduced motion and the low effects setting: draw still, no particles. */
    reduce: boolean;
    paused: boolean;
    /** Job id the firm builds next while none is running, so the lot is staked out and the crew waits on it. */
    idle?: string | null;
    /** Crews hired across all materials; sets how many workers stand on the site. */
    crews?: number;
}
