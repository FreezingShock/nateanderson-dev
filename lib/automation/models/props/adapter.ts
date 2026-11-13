// Converts a scenery PropModel into the shared VoxelModel format (../format.ts)
// so the renderer's loader and baker can draw props like any other model.
import { TAG, type VoxelModel } from "../format";
import type { PropModel } from "./vox";

/**
 * Colours are baked per voxel (species tones plus ambient occlusion), so the
 * palette is built here. When a model has more than 256 colours, channels are
 * rounded to coarser steps until it fits.
 */
export function toVoxelModel(m: PropModel): VoxelModel {
    const n = m.count;
    let step = 1;
    let palette: number[] = [];
    let colors = new Uint8Array(n);
    for (;;) {
        const index = new Map<number, number>();
        palette = [];
        let ok = true;
        for (let q = 0; q < n; q++) {
            const r = Math.min(255, Math.round(m.rgb[q * 3] / step) * step);
            const g = Math.min(255, Math.round(m.rgb[q * 3 + 1] / step) * step);
            const b = Math.min(255, Math.round(m.rgb[q * 3 + 2] / step) * step);
            const hex = (r << 16) | (g << 8) | b;
            let i = index.get(hex);
            if (i === undefined) {
                if (palette.length === 256) { ok = false; break; }
                i = palette.length;
                index.set(hex, i);
                palette.push(hex);
            }
            colors[q] = i;
        }
        if (ok) break;
        step += step < 4 ? 1 : 2;
        colors = new Uint8Array(n);
    }
    const tags = new Uint8Array(n);
    let anyGlow = false;
    for (let q = 0; q < n; q++) if (m.glow[q]) { tags[q] = TAG.GLOW; anyGlow = true; }
    let anySway = false;
    for (let q = 0; q < n; q++) if (m.sway[q]) { anySway = true; break; }
    const size: [number, number, number] = [m.max[0] - m.min[0], m.max[1] - m.min[1], m.max[2] - m.min[2]];
    const model: VoxelModel = {
        id: m.id,
        voxel: m.voxel,
        size,
        palette,
        parts: [{
            id: "body",
            // Model origin is the min corner; the pivot is the prop's base centre, so
            // placements (which use the base centre) only need to subtract the pivot.
            pivot: [-m.min[0], 0, -m.min[2]],
            pos: m.pos,
            colors,
            ...(anyGlow ? { tags } : {}),
            ...(anySway ? { sway: m.sway } : {}),
        }],
    };
    const light = m.anchors?.light;
    if (light) {
        model.lights = [{
            pos: [light[0] / m.voxel - m.min[0], light[1] / m.voxel, light[2] / m.voxel - m.min[2]],
            color: 0xffa040, intensity: 6, distance: 6, when: "always",
        }];
    }
    return model;
}
