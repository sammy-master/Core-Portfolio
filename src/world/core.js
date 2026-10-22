import * as THREE from 'three';
import gsap from 'gsap';
import { globalU } from '../engine/renderer.js';
import { NOISE_GLSL } from './background.js';

export const coreU = {
  uTime: globalU.uTime,
  uProgress: { value: 0.1 },   // 0..1
  uPulse: { value: 0 },
  uGod: { value: 0 },
  uHover: { value: 0 },
};

const coreMat = new THREE.ShaderMaterial({
  uniforms: coreU,
  vertexShader: /* glsl */ `
    ${NOISE_GLSL}
    uniform float uTime, uProgress, uPulse;
    varying vec3 vW; varying vec3 vN; varying float vD;
    void main(){
      vec3 p = position;
      float n = snoise(p * 1.4 + uTime * 0.35);
      float n2 = snoise(p * 3.2 - uTime * 0.5);
      float d = (n * 0.28 + n2 * 0.08) * (0.35 + uProgress * 0.9) + uPulse * 0.25;
      p += normalize(position) * d;
      vD = d;
      vec4 w = modelMatrix * vec4(p, 1.);
      vW = w.xyz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float uTime, uProgress, uPulse, uGod, uHover;
    varying vec3 vW; varying vec3 vN; varying float vD;
    vec3 pal(float t){ return .5 + .5 * cos(6.2831 * (vec3(1.,1.,1.) * t + vec3(.0,.33,.67))); }
    void main(){
      // faceted normal for a crystalline look
      vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
      vec3 V = normalize(cameraPosition - vW);
      float fres = pow(1. - max(dot(fn, V), 0.), 2.4);
      float soft = pow(1. - max(dot(normalize(vN), V), 0.), 1.6);
      float hue = fres * .9 + vD * 1.2 + uTime * .05 + uGod * uTime * .3;
      vec3 irid = pal(hue + .55);
      vec3 base = mix(vec3(.04,.05,.14), vec3(.12,.1,.4), uProgress);
      vec3 col = base + irid * (fres * 1.6 + soft * .5) * (.55 + uProgress * .9);
      col += vec3(.4,.8,1.) * smoothstep(.0, .35, vD) * .5;
      col *= 1. + uPulse * 2.5 + uHover * .35;
      gl_FragColor = vec4(col, 1.);
    }`,
});

export function createCore() {
  const group = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1.7, 28);
  const mesh = new THREE.Mesh(geo, coreMat);
  group.add(mesh);

  // inner star
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 32),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fd8ff').multiplyScalar(2.2), toneMapped: false }),
  );
  group.add(inner);

  // wire shell
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.35, 2)),
    new THREE.LineBasicMaterial({ color: 0x6fb8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  group.add(wire);

  // equatorial rings
  const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), transparent: true, opacity: o, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const r1 = new THREE.Mesh(new THREE.RingGeometry(3.0, 3.03, 128), ringMat('#22e4ff', 0.5));
  const r2 = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.52, 128), ringMat('#b07cff', 0.35));
  r1.rotation.x = Math.PI / 2.3; r2.rotation.x = Math.PI / 1.9; r2.rotation.y = 0.5;
  group.add(r1, r2);

  const light = new THREE.PointLight(0x88aaff, 40, 30, 1.6);
  group.add(light);

  // ---- orbiting skill shards ----
  const shardGroup = new THREE.Group();
  group.add(shardGroup);
  const shardGeo = new THREE.OctahedronGeometry(0.2, 0);
  shardGeo.scale(0.7, 1.7, 0.7);
  const edgeGeo = new THREE.EdgesGeometry(shardGeo);
  const shards = [];
  const palette = ['#22e4ff', '#3dffb5', '#ffc23d', '#ff4fa3', '#b07cff', '#ff5470'];

  function addShard(catIndex, instant = false, from = null) {
    const idx = shards.length;
    const color = new THREE.Color(palette[catIndex % palette.length]);
    const s = new THREE.Group();
    s.add(new THREE.Mesh(shardGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.9), toneMapped: false, transparent: true, opacity: 0.85 })));
    s.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })));
    const orbit = {
      r: 3.4 + (idx % 5) * 0.42 + Math.floor(idx / 5) * 0.12,
      a: Math.random() * Math.PI * 2,
      speed: (0.25 + Math.random() * 0.35) * (idx % 2 ? 1 : -1),
      tilt: (Math.random() - 0.5) * 1.4,
      spin: 1 + Math.random() * 2,
    };
    s.userData = orbit;
    shardGroup.add(s);
    shards.push(s);
    placeShard(s);
    if (!instant && from) {
      // fly in from a world-space position
      const local = shardGroup.worldToLocal(from.clone());
      const target = s.position.clone();
      s.position.copy(local);
      s.scale.setScalar(0.01);
      orbit.flying = true;
      const o = { t: 0 };
      gsap.to(s.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 0.5, ease: 'back.out(2)' });
      gsap.to(o, {
        t: 1, duration: 1.4, delay: 0.1 + Math.random() * 0.3, ease: 'power3.inOut',
        onUpdate: () => {
          placeShard(s);
          const tgt = s.position.clone();
          s.position.lerpVectors(local, tgt, o.t);
          s.position.y += Math.sin(o.t * Math.PI) * 1.6;
        },
        onComplete: () => { orbit.flying = false; gsap.to(s.scale, { x: 1, y: 1, z: 1, duration: 0.4 }); void target; },
      });
    }
    return s;
  }
  function placeShard(s) {
    const o = s.userData;
    const x = Math.cos(o.a) * o.r, z = Math.sin(o.a) * o.r;
    s.position.set(x, Math.sin(o.a * 2 + o.tilt) * o.tilt, z);
  }

  const api = {
    group, mesh, addShard, shards,
    pulse(strength = 1) {
      gsap.fromTo(coreU.uPulse, { value: strength }, { value: 0, duration: 1.1, ease: 'power3.out' });
    },
    setProgress(p, animate = true) {
      if (animate) gsap.to(coreU.uProgress, { value: p, duration: 1.4, ease: 'power2.out' });
      else coreU.uProgress.value = p;
    },
    update(dt, t) {
      mesh.rotation.y += dt * 0.12;
      mesh.rotation.x = Math.sin(t * 0.2) * 0.1;
      wire.rotation.y -= dt * 0.05;
      r1.rotation.z += dt * 0.15; r2.rotation.z -= dt * 0.1;
      inner.scale.setScalar(1 + Math.sin(t * 1.7) * 0.04 + coreU.uPulse.value * 0.3);
      for (const s of shards) {
        const o = s.userData;
        if (!o.flying) { o.a += dt * o.speed * (0.6 + coreU.uProgress.value * 0.6); placeShard(s); }
        s.rotation.y += dt * o.spin; s.rotation.z += dt * 0.5;
      }
    },
    dispose() { /* single instance lives for the app lifetime */ },
  };
  return api;
}
