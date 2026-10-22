import * as THREE from 'three';
import gsap from 'gsap';
import { globalU } from '../engine/renderer.js';
import { NOISE_GLSL } from './background.js';

/**
 * Samples text into a point cloud. Particles start scattered in a sphere,
 * assemble into the letters, dodge the cursor, and can explode outward.
 */
export function createTitle(lines = ['SAKSHAM', 'SHARMA']) {
  const cv = document.createElement('canvas');
  const W = 1400, H = 520;
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 250px "Unbounded Variable", "Unbounded", sans-serif';
  g.fillText(lines[0], W / 2, H * 0.3);
  g.font = '800 250px "Unbounded Variable", "Unbounded", sans-serif';
  g.fillText(lines[1], W / 2, H * 0.74);

  const data = g.getImageData(0, 0, W, H).data;
  const step = 4;
  const targets = [];
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (data[(y * W + x) * 4 + 3] > 128) targets.push(x, y);
    }
  }
  const n = targets.length / 2;
  const worldW = 17;
  const sc = worldW / W;
  const aTarget = new Float32Array(n * 3);
  const aStart = new Float32Array(n * 3);
  const aRnd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    aTarget[i * 3] = (targets[i * 2] - W / 2) * sc;
    aTarget[i * 3 + 1] = -(targets[i * 2 + 1] - H / 2) * sc;
    aTarget[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
    const r = 8 + Math.random() * 30;
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    aStart[i * 3] = r * Math.sin(b) * Math.cos(a);
    aStart[i * 3 + 1] = r * Math.sin(b) * Math.sin(a);
    aStart[i * 3 + 2] = r * Math.cos(b) - 6;
    aRnd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aTarget, 3));
  geo.setAttribute('aTarget', new THREE.BufferAttribute(aTarget, 3));
  geo.setAttribute('aStart', new THREE.BufferAttribute(aStart, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(aRnd, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const u = {
    uTime: globalU.uTime,
    uForm: { value: 0 },
    uExplode: { value: 0 },
    uMouse: { value: new THREE.Vector3(999, 999, 0) },
    uPx: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uHalf: { value: worldW / 2 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      ${NOISE_GLSL}
      attribute vec3 aTarget; attribute vec3 aStart; attribute float aRnd;
      uniform float uTime, uForm, uExplode, uPx, uHalf; uniform vec3 uMouse;
      varying vec3 vC; varying float vA;
      float ease(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }
      void main(){
        float f = ease(clamp((uForm - aRnd * .45) / .55, 0., 1.));
        vec3 p = mix(aStart, aTarget, f);
        // swirl while travelling
        float sw = (1. - f) * 3.;
        p.xy += vec2(sin(uTime * 1.3 + aRnd * 30.), cos(uTime * 1.1 + aRnd * 20.)) * sw * .25;
        // idle shimmer when formed
        float n = snoise(vec3(aTarget.xy * .5, uTime * .4 + aRnd));
        p += vec3(n * .05, snoise(vec3(aTarget.yx * .5, uTime * .4)) * .05, n * .12) * f;
        // cursor repulsion
        vec2 d = p.xy - uMouse.xy;
        float dist = length(d);
        float push = smoothstep(2.2, 0., dist) * f;
        p.xy += normalize(d + 1e-4) * push * 1.1;
        p.z += push * 1.4;
        // explode outward
        vec3 dir = normalize(aTarget + vec3(0., 0., 1.) * (.3 + aRnd) + vec3(aRnd - .5, aRnd * .7 - .3, 0.));
        p += dir * uExplode * (10. + aRnd * 40.);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = (2.6 + aRnd * 2.8 + push * 3.) * uPx * (12. / -mv.z) * (1. - uExplode * .7);
        gl_Position = projectionMatrix * mv;
        float t = (aTarget.x / uHalf) * .5 + .5;
        vec3 c1 = vec3(.15, .85, 1.); vec3 c2 = vec3(.62, .4, 1.); vec3 c3 = vec3(1., .3, .65);
        vC = t < .5 ? mix(c1, c2, t * 2.) : mix(c2, c3, (t - .5) * 2.);
        vC = mix(vec3(1.), vC, .7 + .3 * sin(aRnd * 6.28 + uTime)) * (1.3 + push * 2.5);
        vA = (1. - uExplode) * (.35 + .65 * f);
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, .05, d);
        gl_FragColor = vec4(vC * a * vA, a * vA);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);

  const mouse = new THREE.Vector3();
  return {
    group,
    count: n,
    form(duration = 2.8) { return gsap.to(u.uForm, { value: 1, duration, ease: 'power1.inOut' }); },
    explode(duration = 1.6) {
      return gsap.to(u.uExplode, { value: 1, duration, ease: 'power3.in' });
    },
    setMouseWorld(v) { mouse.copy(v); u.uMouse.value.copy(v); },
    update(dt, t) {
      group.rotation.y = Math.sin(t * 0.25) * 0.08;
      group.rotation.x = Math.sin(t * 0.2) * 0.03;
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
