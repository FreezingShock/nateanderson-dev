// Sky dome: a large sphere that follows the camera, drawn behind everything. The gradient, sun halo,
// sun disc and rays come from the approved dusk look (LOOK-SPEC.md, sky section). On top of that the
// sky now follows the clock: the sun climbs and sinks with the time of day, a warm haze band sits on
// the horizon, high streaks of cirrus drift across, and at night a crescent moon, brass-tinted stars
// and the odd shooting star come out. Everything is computed in the shader, so it costs one draw.
import * as THREE from "three";
import { SKY_SUN_DIR } from "./config";

const SKY_RADIUS = 600;

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // keep the dome on the far plane
}`;

const fragment = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uMoon;
uniform vec3 uHorizon;
uniform vec3 uMid;
uniform vec3 uTop;
uniform vec3 uGlow;
uniform float uNight;
uniform float uTime;
uniform float uMotion;
varying vec3 vDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// One star layer: a jittered point per cell on an octahedral-ish projection of the dome.
float stars(vec3 d, float scale, float keep) {
  vec2 uv = vec2(atan(d.z, d.x) * 0.5, d.y) * scale;
  vec2 id = floor(uv);
  vec2 f = fract(uv) - 0.5;
  float h = hash21(id);
  if (h > keep) return 0.0;
  vec2 o = vec2(hash21(id + 7.1), hash21(id + 3.7)) - 0.5;
  float dist = length(f - o * 0.7);
  float tw = 0.65 + 0.35 * sin(uTime * uMotion * (1.5 + h * 4.0) + h * 40.0);
  return smoothstep(0.09, 0.0, dist) * tw * (0.4 + h / keep);
}

void main() {
  vec3 d = normalize(vDir);
  vec3 s = normalize(uSun);
  float h = d.y;

  // Base gradient (approved dusk look).
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uTop, smoothstep(0.18, 0.75, h));
  if (h < 0.0) col = uHorizon;

  // Warm haze band that hugs the horizon, brightest on the sun side.
  float c = dot(d, s);
  float cs = max(c, 0.0);
  float band = exp(-abs(h - 0.015) * 26.0);
  col += uGlow * band * (0.10 + 0.22 * pow(cs, 3.0)) * (1.0 - uNight * 0.85);

  // High cirrus streaks, stretched along one heading and drifting slowly.
  if (h > 0.02) {
    vec2 cp = d.xz / (h + 0.12);
    cp = vec2(cp.x * 0.55 + cp.y * 0.3, cp.y * 2.4 - cp.x * 0.4);
    cp.x += uTime * uMotion * 0.006;
    float n = vnoise(cp * 1.6) * 0.6 + vnoise(cp * 3.7) * 0.3 + vnoise(cp * 8.0) * 0.1;
    float wisp = smoothstep(0.55, 0.85, n) * smoothstep(0.02, 0.2, h) * (1.0 - smoothstep(0.55, 0.9, h));
    vec3 lit = mix(uMid * 1.25 + uGlow * 0.35, uGlow * 0.9 + vec3(0.12, 0.06, 0.02), pow(cs, 2.0));
    lit = mix(lit, uMid * 1.5 + vec3(0.03, 0.03, 0.05), uNight);
    col = mix(col, lit, wisp * 0.42);
  }

  // Sun halo and rays fan out from the sun on the sun side only. They fade as the sun drops away.
  float sunUp = smoothstep(-0.12, 0.02, s.y);
  vec3 glow = uGlow * (pow(cs, 10.0) * 0.55 + pow(cs, 90.0) * 1.2);
  vec3 up = abs(s.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(s, up));
  vec3 t2 = cross(s, t1);
  float r = acos(clamp(c, -1.0, 1.0));
  float a = atan(dot(d, t2), dot(d, t1));
  float ray = pow((0.5 + 0.5 * sin(a * 19.0 + sin(a * 5.0) * 2.0)) * (0.55 + 0.45 * sin(a * 7.3 + 1.0)), 2.0)
    * smoothstep(0.015, 0.09, r) * exp(-r * 2.6) * 0.75;
  glow += uGlow * ray * step(0.0, c);
  col += glow * sunUp;
  float disc = smoothstep(0.99935, 0.99965, c) * step(-0.01, h);
  col += vec3(1.0, 0.93, 0.75) * disc * 2.5 * sunUp;

  // Night: stars, a crescent moon with a soft halo, and an occasional shooting star.
  if (uNight > 0.01 && h > -0.02) {
    float above = smoothstep(-0.02, 0.18, h);
    float st = stars(d, 70.0, 0.11) + stars(d, 150.0, 0.06) * 0.6;
    vec3 starCol = mix(vec3(1.0, 0.86, 0.62), vec3(0.92, 0.9, 1.0), hash21(floor(d.xz * 90.0)));
    col += starCol * st * above * uNight * 1.3;

    vec3 m = normalize(uMoon);
    float mc = dot(d, m);
    col += vec3(0.55, 0.5, 0.42) * (pow(max(mc, 0.0), 60.0) * 0.35 + pow(max(mc, 0.0), 600.0) * 0.6) * uNight;
    float moon = smoothstep(0.99955, 0.99975, mc);
    // Crescent: subtract a disc offset toward the sun side of the moon.
    vec3 off = normalize(m + normalize(cross(m, vec3(0.0, 1.0, 0.0))) * 0.022);
    float bite = smoothstep(0.99955, 0.99975, dot(d, off));
    col += vec3(1.0, 0.93, 0.78) * max(moon - bite, 0.0) * 1.8 * uNight;

    // Shooting star: one streak every eight seconds or so, in a random patch of the upper sky.
    float slot = floor(uTime * uMotion / 8.0);
    float ph = fract(uTime * uMotion / 8.0);
    if (uMotion > 0.5 && hash21(vec2(slot, 4.0)) > 0.35 && ph < 0.18) {
      float az = hash21(vec2(slot, 1.0)) * 6.2832;
      float el = 0.35 + hash21(vec2(slot, 2.0)) * 0.35;
      vec3 p0 = normalize(vec3(cos(az), el, sin(az)));
      vec3 dir = normalize(cross(p0, vec3(0.0, 1.0, 0.0)) + vec3(0.0, -0.35, 0.0));
      float k = ph / 0.18;
      vec3 head = normalize(p0 + dir * k * 0.35);
      vec3 rel = d - head;
      float along = dot(rel, -dir);
      float across = length(rel + dir * along);
      float tail = smoothstep(0.0025, 0.0, across) * step(0.0, along) * smoothstep(0.09, 0.0, along);
      col += vec3(1.0, 0.88, 0.6) * tail * (1.0 - k) * 1.6 * uNight;
    }
  }

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class SkyDome {
    readonly mesh: THREE.Mesh;
    private readonly uniforms = {
        uSun: { value: new THREE.Vector3(...SKY_SUN_DIR).normalize() },
        uMoon: { value: new THREE.Vector3(-0.6, 0.45, 0.66).normalize() },
        uHorizon: { value: new THREE.Color(0xb87a4c) },
        uMid: { value: new THREE.Color(0xa9505a) },
        uTop: { value: new THREE.Color(0x241a4a) },
        uGlow: { value: new THREE.Color(0xffc27a) },
        uNight: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: 1 },
    };

    constructor(scene: THREE.Scene) {
        const material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertex,
            fragmentShader: fragment,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
        });
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(SKY_RADIUS, 48, 24),
            material
        );
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = -1;
        scene.add(this.mesh);
    }

    setColors(horizon: number, mid: number, top: number): void {
        this.uniforms.uHorizon.value.setHex(horizon);
        this.uniforms.uMid.value.setHex(mid);
        this.uniforms.uTop.value.setHex(top);
    }

    /** Sun and moon directions (unit-ish vectors from the island) and the night amount 0..1. */
    setCelestial(sun: THREE.Vector3, moon: THREE.Vector3, night: number): void {
        this.uniforms.uSun.value.copy(sun).normalize();
        this.uniforms.uMoon.value.copy(moon).normalize();
        this.uniforms.uNight.value = night;
    }

    /** Clock for twinkle, drifting cirrus and shooting stars. `motion` 0 freezes them (low fx). */
    tick(time: number, motion: boolean): void {
        this.uniforms.uTime.value = time;
        this.uniforms.uMotion.value = motion ? 1 : 0;
    }

    /** Keeps the dome centred on the camera so it never reads as near geometry. */
    follow(position: THREE.Vector3): void {
        this.mesh.position.copy(position);
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
    }
}
