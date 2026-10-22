import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera } from './renderer.js';

const MAX = 4000;
const pos = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3);
const col = new Float32Array(MAX * 3);
const siz = new Float32Array(MAX);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const alpha = new Float32Array(MAX);
const grav = new Float32Array(MAX);
let cursor = 0;

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);

const mat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uScale: { value: 600 } },
  vertexShader: /* glsl */ `
    attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
    varying vec3 vC; varying float vA; uniform float uScale;
    void main(){
      vC = aColor; vA = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uScale / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vC; varying float vA;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vC * a * vA * 2.2, a * vA);
    }`,
});
const points = new THREE.Points(geo, mat);
points.frustumCulled = false;
points.renderOrder = 10;
scene.add(points);

const _c = new THREE.Color();
const rings = [];
const ringGeo = new THREE.RingGeometry(0.92, 1, 64);

let shakeAmt = 0, shakeT = 0, shakeDur = 0;
const shakeOff = new THREE.Vector3();

const flashEl = document.createElement('div');
flashEl.className = 'flash';
flashEl.setAttribute('aria-hidden', 'true');
document.addEventListener('DOMContentLoaded', () => document.body.appendChild(flashEl));
if (document.body) document.body.appendChild(flashEl);

export const fx = {
  /** Radial particle burst at a world position. color: hex | THREE.Color */
  burst(p, color = 0xffffff, n = 40, speed = 4, size = 0.18, lifeS = 0.9, gravity = 0) {
    _c.set(color);
    for (let i = 0; i < n; i++) {
      const k = cursor = (cursor + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const s = speed * (0.35 + Math.random() * 0.8);
      pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
      vel[k * 3] = Math.sin(b) * Math.cos(a) * s;
      vel[k * 3 + 1] = Math.sin(b) * Math.sin(a) * s;
      vel[k * 3 + 2] = Math.cos(b) * s;
      col[k * 3] = _c.r; col[k * 3 + 1] = _c.g; col[k * 3 + 2] = _c.b;
      siz[k] = size * (0.5 + Math.random());
      maxLife[k] = life[k] = lifeS * (0.6 + Math.random() * 0.6);
      grav[k] = gravity;
      alpha[k] = 1;
    }
  },
  /** Expanding shockwave ring facing the camera. */
  ring(p, color = 0xffffff, radius = 2.5, dur = 0.7) {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(2), transparent: true,
      opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.position.copy(p);
    mesh.quaternion.copy(camera.quaternion);
    mesh.scale.setScalar(0.1);
    scene.add(mesh);
    const o = { v: 0 };
    gsap.to(o, {
      v: 1, duration: dur, ease: 'power3.out',
      onUpdate: () => { mesh.scale.setScalar(0.1 + o.v * radius); m.opacity = 0.9 * (1 - o.v); },
      onComplete: () => { scene.remove(mesh); m.dispose(); },
    });
    rings.push(mesh);
  },
  shake(amount = 0.3, dur = 0.35) { shakeAmt = Math.max(shakeAmt, amount); shakeT = shakeDur = dur; },
  flash(color = '#ffffff', strength = 0.5) {
    flashEl.style.background = color;
    gsap.fromTo(flashEl, { opacity: strength }, { opacity: 0, duration: 0.5, ease: 'power2.out' });
  },
  /** Floating DOM text anchored to a world position. */
  pop(worldPos, text, color = '#ffffff') {
    const v = worldPos.clone().project(camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.color = color;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    gsap.fromTo(el, { y: 0, scale: 0.6, opacity: 0 }, {
      y: -60, scale: 1, opacity: 1, duration: 0.25, ease: 'back.out(3)',
      onComplete: () => gsap.to(el, { y: -90, opacity: 0, duration: 0.6, delay: 0.25, onComplete: () => el.remove() }),
    });
  },
  update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { alpha[i] = 0; continue; }
      life[i] -= dt;
      const k = i * 3;
      vel[k + 1] -= grav[i] * dt;
      pos[k] += vel[k] * dt; pos[k + 1] += vel[k + 1] * dt; pos[k + 2] += vel[k + 2] * dt;
      vel[k] *= 0.985; vel[k + 1] *= 0.985; vel[k + 2] *= 0.985;
      alpha[i] = Math.max(0, life[i] / maxLife[i]);
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aColor.needsUpdate = true;
    mat.uniforms.uScale.value = window.innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    if (shakeT > 0) {
      shakeT -= dt;
      const k = (shakeT / shakeDur) * shakeAmt;
      shakeOff.set((Math.random() - 0.5) * k, (Math.random() - 0.5) * k, 0);
      if (shakeT <= 0) { shakeAmt = 0; shakeOff.set(0, 0, 0); }
    }
  },
  applyShake() { camera.position.add(shakeOff); },
  removeShake() { camera.position.sub(shakeOff); },
};
