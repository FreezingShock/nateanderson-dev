// Sky dome: a large sphere that follows the camera, drawn behind everything. The gradient, sun halo,
// sun disc and the light rays all come from the approved look (LOOK-SPEC.md, sky section).
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
uniform vec3 uHorizon;
uniform vec3 uMid;
uniform vec3 uTop;
uniform vec3 uGlow;
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  vec3 s = normalize(uSun);
  float h = d.y;

  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uTop, smoothstep(0.18, 0.75, h));
  if (h < 0.0) col = uHorizon;

  float c = dot(d, s);
  float cs = max(c, 0.0);
  vec3 glow = uGlow * (pow(cs, 10.0) * 0.55 + pow(cs, 90.0) * 1.2);

  // Rays fan out from the sun on the sun side only.
  vec3 up = abs(s.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(s, up));
  vec3 t2 = cross(s, t1);
  float r = acos(clamp(c, -1.0, 1.0));
  float a = atan(dot(d, t2), dot(d, t1));
  float ray = pow((0.5 + 0.5 * sin(a * 19.0 + sin(a * 5.0) * 2.0)) * (0.55 + 0.45 * sin(a * 7.3 + 1.0)), 2.0)
    * smoothstep(0.015, 0.09, r) * exp(-r * 2.6) * 0.75;
  glow += uGlow * ray * step(0.0, c);

  col += glow;
  float disc = smoothstep(0.99935, 0.99965, c);
  col += vec3(1.0, 0.93, 0.75) * disc * 2.5;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly uniforms = {
    uSun: { value: new THREE.Vector3(...SKY_SUN_DIR).normalize() },
    uHorizon: { value: new THREE.Color(0xb87a4c) },
    uMid: { value: new THREE.Color(0xa9505a) },
    uTop: { value: new THREE.Color(0x241a4a) },
    uGlow: { value: new THREE.Color(0xffc27a) },
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
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  setColors(horizon: number, mid: number, top: number): void {
    this.uniforms.uHorizon.value.setHex(horizon);
    this.uniforms.uMid.value.setHex(mid);
    this.uniforms.uTop.value.setHex(top);
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
