// Pixel and dither pass. The scene renders into a target `pixelSize` times smaller than the canvas,
// then a full-screen pass upscales it with nearest sampling and, when enabled, quantises each
// channel to a few levels with a 4x4 Bayer threshold. Turning dither off keeps the blocky pixels
// and drops the quantising, which is the readability toggle.
import * as THREE from "three";

const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragment = /* glsl */ `
uniform sampler2D tColor;
uniform float uPixel;
uniform float uDither;
uniform float uLevels;
uniform float uExposure;
varying vec2 vUv;

// 4x4 ordered-dither threshold, 0..1, from the Bayer matrix.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  // The target holds linear light; encode to sRGB and apply the exposure the reference uses.
  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)) * uExposure;
  if (uDither > 0.5) {
    float th = bayer4(floor(gl_FragCoord.xy / uPixel)) + 1.0 / 32.0;
    float steps = uLevels - 1.0;
    c = floor(c * steps + th) / steps;
  }
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class PixelDitherPass {
  readonly target: THREE.WebGLRenderTarget;
  private readonly material: THREE.ShaderMaterial;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly renderer: THREE.WebGLRenderer;

  constructor(renderer: THREE.WebGLRenderer, pixelSize: number, levels = 6) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        uPixel: { value: pixelSize },
        uDither: { value: 1 },
        uLevels: { value: levels },
        uExposure: { value: 1.12 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  /** Sizes the scene target for a canvas of `cssWidth` by `cssHeight` device pixels at this pixel size. */
  resize(width: number, height: number, pixelSize: number): void {
    this.material.uniforms.uPixel.value = pixelSize;
    this.target.setSize(Math.max(1, Math.floor(width / pixelSize)), Math.max(1, Math.floor(height / pixelSize)));
  }

  setDither(on: boolean): void {
    this.material.uniforms.uDither.value = on ? 1 : 0;
  }

  setLevels(levels: number): void {
    this.material.uniforms.uLevels.value = levels;
  }

  /** Renders the scene into the target, then the dither pass to the canvas. */
  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.target.dispose();
    this.material.dispose();
  }
}
