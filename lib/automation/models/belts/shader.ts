// GPU animation for the logistics kit. Patches a standard material so slats slide
// and gears spin with zero per-frame CPU work: the only thing that changes per
// frame is one `uPhase` uniform per belt tier (cells travelled so far).
//
// Mirrors paths.ts exactly. If you change a path there, change it here too
// (tests/automation/belts.test.mjs checks the JS side for continuity).

import { BELT_Y, RAMP_RISE } from "./paths";

const f = (n: number) => n.toFixed(4);

export const BELT_VERTEX_HEAD = /* glsl */ `
attribute float aMo;
attribute vec3 aA;
attribute vec4 aB;
uniform float uPhase;
varying float vBwGlow;

void bwPath(float id, float u, out vec3 p, out vec3 t) {
    p = vec3(0.5, ${f(BELT_Y)}, u);
    t = vec3(0.0, 0.0, 1.0);
    float H = 1.5707963;
    if (id < 0.5) {
    } else if (id < 1.5) {
        float a = u * H;
        p = vec3(0.5 * sin(a), ${f(BELT_Y)}, 1.0 - 0.5 * cos(a));
        t = vec3(cos(a), 0.0, sin(a));
    } else if (id < 2.5) {
        float a = u * H;
        p = vec3(1.0 - 0.5 * sin(a), ${f(BELT_Y)}, 1.0 - 0.5 * cos(a));
        t = vec3(-cos(a), 0.0, sin(a));
    } else if (id < 3.5) {
        p.y = ${f(BELT_Y)} + u * ${f(RAMP_RISE)};
        t = normalize(vec3(0.0, ${f(RAMP_RISE)}, 1.0));
    } else if (id < 4.5) {
        p.y = ${f(BELT_Y)} + (1.0 - u) * ${f(RAMP_RISE)};
        t = normalize(vec3(0.0, -${f(RAMP_RISE)}, 1.0));
    } else if (id < 5.5) {
        p.z = u * 0.5;
    } else if (id < 6.5) {
        p.z = 0.5 + u * 0.5;
    } else if (id < 7.5) {
        p = vec3(u * 0.5, ${f(BELT_Y)}, 0.5); t = vec3(1.0, 0.0, 0.0);
    } else if (id < 8.5) {
        p = vec3(1.0 - u * 0.5, ${f(BELT_Y)}, 0.5); t = vec3(-1.0, 0.0, 0.0);
    } else if (id < 9.5) {
        p = vec3(0.5 - u * 0.5, ${f(BELT_Y)}, 0.5); t = vec3(-1.0, 0.0, 0.0);
    } else {
        p = vec3(0.5 + u * 0.5, ${f(BELT_Y)}, 0.5); t = vec3(1.0, 0.0, 0.0);
    }
}

vec3 bwRotate(vec3 v, vec3 axis, float ang) {
    float c = cos(ang), s = sin(ang);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
}
`;

/** Replaces <beginnormal_vertex>: animated normal in object space. */
export const BELT_NORMAL = /* glsl */ `
vec3 objectNormal = vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif
vec3 bwP = position;
vBwGlow = aMo < 0.5 ? aB.w : 0.0;
if (aMo > 0.5 && aMo < 1.5) {
    float len = aB.z;
    float s = mod(aB.x + uPhase, len);
    vec3 pp; vec3 tt;
    bwPath(aB.y, s / len, pp, tt);
    vec3 R = normalize(vec3(tt.z, 0.0, -tt.x));
    vec3 U = cross(tt, R);
    bwP = pp + R * aA.x + U * aA.y + tt * aA.z;
    objectNormal = R * normal.x + U * normal.y + tt * normal.z;
} else if (aMo > 1.5) {
    float rate = length(aB.xyz);
    vec3 ax = aB.xyz / max(rate, 1e-5);
    float ang = uPhase * rate;
    bwP = aA + bwRotate(position - aA, ax, ang);
    objectNormal = bwRotate(normal, ax, ang);
}
`;

/** Replaces <begin_vertex>. */
export const BELT_BEGIN = /* glsl */ `
vec3 transformed = bwP;
`;

/** Depth pass (shadows) has no normal chunk, so it computes the position itself. */
export const BELT_BEGIN_DEPTH = /* glsl */ `
vec3 transformed = position;
if (aMo > 0.5 && aMo < 1.5) {
    float len = aB.z;
    float s = mod(aB.x + uPhase, len);
    vec3 pp; vec3 tt;
    bwPath(aB.y, s / len, pp, tt);
    vec3 R = normalize(vec3(tt.z, 0.0, -tt.x));
    vec3 U = cross(tt, R);
    transformed = pp + R * aA.x + U * aA.y + tt * aA.z;
} else if (aMo > 1.5) {
    float rate = length(aB.xyz);
    transformed = aA + bwRotate(position - aA, aB.xyz / max(rate, 1e-5), uPhase * rate);
}
`;

export const BELT_FRAGMENT_HEAD = /* glsl */ `
varying float vBwGlow;
`;

/** Glow voxels (lamps) light themselves, like the unlit glow mesh in the reference scene. */
export const BELT_EMISSIVE = /* glsl */ `
totalEmissiveRadiance += diffuseColor.rgb * vBwGlow * 1.4;
`;
