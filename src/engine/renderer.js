import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Shared uniforms: any shader may read these. */
export const globalU = {
  uTime: { value: 0 },
  uWarp: { value: 0 },
};

const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.setClearColor(0x03040b, 1);

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
camera.position.set(0, 2, 16);

const PR_STEPS = [Math.min(window.devicePixelRatio || 1, 2), 1.25, 1];
let prLevel = 0;

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
export const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.7, 0.55);

/** Final cinematic pass: chromatic aberration, vignette, grain, glitch. */
export const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uTime: globalU.uTime,
    uWarp: globalU.uWarp,
    uGlitch: { value: 0 },
    uAberr: { value: 0.0016 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uWarp, uGlitch, uAberr;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r = length(c);
      // glitch: horizontal slice displacement
      float band = floor(uv.y * 24.0 + floor(uTime * 12.0));
      float g = step(0.82, hash(vec2(band, floor(uTime * 12.0)))) * uGlitch;
      uv.x += g * 0.06 * (hash(vec2(band, 3.0)) - 0.5);
      // warp: radial zoom blur-ish + stronger aberration
      float ab = uAberr + uWarp * 0.018 * r + g * 0.01;
      vec2 dir = normalize(c + 1e-5);
      vec3 col;
      col.r = texture2D(tDiffuse, uv - dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv + dir * ab).b;
      if (uWarp > 0.01) {
        vec3 acc = col;
        for (int i = 1; i < 6; i++) {
          float s = float(i) / 6.0 * uWarp * 0.06;
          acc += texture2D(tDiffuse, uv - c * s).rgb;
        }
        col = acc / 6.0;
      }
      // vignette
      col *= smoothstep(1.05, 0.25, r * 1.25);
      // film grain
      col += (hash(uv * 900.0 + uTime) - 0.5) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const outputPass = new OutputPass();
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(finalPass);
composer.addPass(outputPass);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(PR_STEPS[prLevel]);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(PR_STEPS[prLevel]);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  for (const fn of resizeFns) fn(w, h);
}
const resizeFns = new Set();
export function onResize(fn) { resizeFns.add(fn); fn(window.innerWidth, window.innerHeight); }
window.addEventListener('resize', resize);

/** Visible world size at z = 0 for the camera at z = camZ (games use camZ = 10). */
export function visibleSize(camZ = camera.position.z) {
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camZ;
  return { w: h * camera.aspect, h };
}

const updaters = new Set();
const beforeRender = new Set();
const afterRender = new Set();
export function onFrame(fn) { updaters.add(fn); return () => updaters.delete(fn); }
export function onBeforeRender(fn) { beforeRender.add(fn); }
export function onAfterRender(fn) { afterRender.add(fn); }

const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0;
export function startLoop() {
  resize();
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    globalU.uTime.value += dt;
    for (const fn of updaters) fn(dt, globalU.uTime.value);
    // adaptive quality: step the pixel ratio down on slow GPUs
    fpsAcc += dt; fpsN++;
    if (fpsN >= 90) {
      const avg = fpsAcc / fpsN;
      if (avg > 1 / 36 && prLevel < PR_STEPS.length - 1) { prLevel++; resize(); }
      fpsAcc = 0; fpsN = 0;
    }
    for (const fn of beforeRender) fn(dt);
    composer.render(dt);
    for (const fn of afterRender) fn(dt);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export { THREE };
