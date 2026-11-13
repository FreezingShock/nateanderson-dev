// Small ambient life. Each creature is a short list of frames (flip between
// them on a timer); the renderer moves them along simple paths.
import { FLOWER } from "./palette";
import { Vox, type PropModel } from "./vox";

/** Gull, 4 wing frames, wingspan about 0.9 units. Faces +x. */
export function gull(): PropModel[] {
    const frames: PropModel[] = [];
    const lift = [3, 1, -1, 1];
    for (let f = 0; f < 4; f++) {
        const v = new Vox(`life.gull.${f}`);
        v.box(-3, 0, -1, 4, 2, 1, 0xf2ece0); // body
        v.box(4, 1, -1, 6, 2, 1, 0xf2ece0); // head
        v.set(6, 1, 0, 0xe0a030); v.set(6, 1, -1, 0xe0a030); // beak
        v.box(-5, 1, -1, -3, 2, 1, 0x8a8a90); // tail
        for (let s = 1; s <= 5; s++) {
            const y = Math.round(1 + (lift[f] * s) / 5);
            const c = s >= 4 ? 0x3a3a40 : 0xd8d4cc;
            v.box(-1, y, s, 2, y + 1, s + 1, c);
            v.box(-1, y, -s - 1, 2, y + 1, -s, c);
        }
        frames.push(v.build({ ao: 0, jitter: 0.03, lod: false }));
    }
    return frames;
}

/** Butterfly, 2 frames. Colours: 0 ember, 1 gold, 2 sky blue. */
export function butterfly(kind = 0): PropModel[] {
    const col = [FLOWER.ember, FLOWER.gold, FLOWER.sky][kind % 3];
    return [0, 1].map((f) => {
        const v = new Vox(`life.butterfly.${kind}.${f}`);
        v.box(0, 0, 0, 1, 1, 3, 0x2a2018);
        for (const side of [-1, 1]) {
            const y = f === 0 ? 0 : 1;
            v.set(side < 0 ? -1 : 1, y, 0, col); v.set(side < 0 ? -1 : 1, y, 1, col); v.set(side < 0 ? -2 + f : 2 - f, y + f, 0, col);
            v.set(side < 0 ? -1 : 1, y, 2, 0x2a2018);
        }
        return v.build({ ao: 0, jitter: 0, lod: false });
    });
}

/** Fish arcing out of the water, 3 frames (rise, top, dive). Faces +x. */
export function fish(): PropModel[] {
    const tilt = [2, 0, -2];
    return tilt.map((t, f) => {
        const v = new Vox(`life.fish.${f}`);
        for (let i = -3; i <= 3; i++) {
            const y = Math.round((i * t) / 3);
            v.set(i, y, 0, i === 3 ? 0x2a2018 : i < -2 ? 0x5a7a9a : 0x9ab0c4);
            if (Math.abs(i) < 2) v.set(i, y + 1, 0, 0x6a8aa8);
        }
        v.set(-4, Math.round((-4 * t) / 3) + 1, 0, 0x5a7a9a); v.set(-4, Math.round((-4 * t) / 3) - 1, 0, 0x5a7a9a);
        return v.build({ ao: 0, jitter: 0.02, lod: false });
    });
}

/** Expanding ripple ring, 4 frames, lies flat on the water. */
export function ripple(): PropModel[] {
    return [2, 4, 6, 8].map((r, f) => {
        const v = new Vox(`life.ripple.${f}`);
        for (let a = 0; a < 64; a++) {
            const ang = (a / 64) * Math.PI * 2;
            v.set(Math.cos(ang) * r, 0, Math.sin(ang) * r, f < 2 ? 0xe8f0f0 : 0xb8d0d8);
        }
        return v.build({ ao: 0, jitter: 0, lod: false });
    });
}

export const LIFE = { gull, butterfly, fish, ripple } as const;
