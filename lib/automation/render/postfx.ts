// Pixel and dither pass. The scene renders into a target `pixelSize` times smaller than the canvas,
// then a full-screen pass upscales it with nearest sampling and, when enabled, quantises each
// channel to a few levels. The 4x4 Bayer threshold is applied only where the picture has an edge
// (a neighbouring block differs in brightness). Flat surfaces such as the ground snap to their
// nearest level instead, so one base tone reads as one tone and the dither stays on edges and
// paths. Turning dither off keeps the blocky pixels and drops the quantising, which is the
// readability toggle. Colour at each block seam is blended across about one block (see `soft`), so
// neighbouring surfaces meet in a soft gradient instead of a hard line.
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
uniform vec2 uTexel;
uniform vec2 uSize;
varying vec2 vUv;

// 4x4 ordered-dither threshold, 0..1, from the Bayer matrix.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2.0 + a.y * a.y * 0.75);
}
float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

// Encoded sRGB colour of the scene at a target texel, with the reference exposure applied.
vec3 encoded(vec2 uv) {
  vec3 c = texture2D(tColor, uv).rgb;
  return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)) * uExposure;
}

// Colour across a block seam. Each block is one flat colour, so a hard nearest sample draws every
// surface edge as a line. This blends the four nearest block centres, so a seam fades over about one
// block while block centres stay flat. Interior pixels of a flat block read the same colour, so the
// pixel look holds. The smoothstep keeps the blend near the seam, not across the whole block.
vec3 soft(vec2 uv) {
  vec2 p = uv * uSize - 0.5;
  vec2 i = floor(p);
  vec2 f = smoothstep(vec2(0.0), vec2(1.0), p - i);
  vec2 b = (i + 0.5) / uSize;
  vec3 c00 = encoded(b);
  vec3 c10 = encoded(b + vec2(uTexel.x, 0.0));
  vec3 c01 = encoded(b + vec2(0.0, uTexel.y));
  vec3 c11 = encoded(b + uTexel);
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}

void main() {
  // The hard sample decides where the dither edges are; the soft sample is the colour drawn.
  vec3 hard = encoded(vUv);
  vec3 c = soft(vUv);
  if (uDither > 0.5) {
    // Edge weight: the largest brightness step to a neighbouring block. Flat areas give ~0 and
    // dither off; edges give ~1 and keep the full Bayer pattern.
    vec3 d = abs(encoded(vUv + vec2(uTexel.x, 0.0)) - hard);
    d = max(d, abs(encoded(vUv - vec2(uTexel.x, 0.0)) - hard));
    d = max(d, abs(encoded(vUv + vec2(0.0, uTexel.y)) - hard));
    d = max(d, abs(encoded(vUv - vec2(0.0, uTexel.y)) - hard));
    float edge = max(d.r, max(d.g, d.b));
    float w = smoothstep(0.012, 0.06, edge);
    float th = mix(0.5, bayer4(floor(gl_FragCoord.xy / uPixel)) + 1.0 / 32.0, w);
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
                uTexel: { value: new THREE.Vector2(1, 1) },
                uSize: { value: new THREE.Vector2(1, 1) },
            },
            vertexShader: vertex,
            fragmentShader: fragment,
            depthTest: false,
            depthWrite: false,
        });
        this.scene.add(
            new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
        );
    }

    /** Sizes the scene target for a canvas of `cssWidth` by `cssHeight` device pixels at this pixel size. */
    resize(width: number, height: number, pixelSize: number): void {
        this.material.uniforms.uPixel.value = pixelSize;
        const tw = Math.max(1, Math.floor(width / pixelSize));
        const th = Math.max(1, Math.floor(height / pixelSize));
        this.target.setSize(tw, th);
        this.material.uniforms.uTexel.value.set(1 / tw, 1 / th);
        this.material.uniforms.uSize.value.set(tw, th);
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
