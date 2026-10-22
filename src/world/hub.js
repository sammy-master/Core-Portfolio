import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, globalU, onFrame, onResize } from '../engine/renderer.js';
import { input, pick } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { missions, categories, facts } from '../data/content.js';
import { store } from '../engine/store.js';
import { createCore, coreU } from './core.js';
import { glowSprite } from '../engine/helpers.js';
import { setNebula, streaks } from './background.js';

const pad = (n) => String(n).padStart(2, '0');
const catIndex = (id) => Math.max(0, categories.findIndex((c) => c.id === id));

export function createHub({ onSelect, onToast }) {
  const root = new THREE.Group();
  const group = new THREE.Group();
  root.add(group);
  scene.add(root);

  const core = createCore();
  group.add(core.group);
  const coreHit = new THREE.Mesh(new THREE.SphereGeometry(2.3, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
  coreHit.userData.core = true;
  group.add(coreHit);

  // ---- portal layout: chronological spiral ----
  const portals = [];
  const pts = [];
  missions.forEach((m, i) => {
    const ang = i * 0.8 + 0.4;
    const rad = 5.7 + i * 0.36;
    const y = Math.sin(i * 1.15) * 1.5;
    const p = new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    pts.push(p.clone());
    const color = new THREE.Color(m.color);
    const g = new THREE.Group();
    g.position.copy(p);
    const ringMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.95 });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.035, 12, 72), ringMat);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.025, 12, 64), ringMat);
    const orbGeo = new THREE.IcosahedronGeometry(0.34, 1);
    const wire = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.8), wireframe: true, toneMapped: false }));
    const solid = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.4), toneMapped: false, transparent: true, opacity: 0 }));
    const halo = glowSprite(m.color, 3.4, 0.28);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.portal = i;
    g.add(ringA, ringB, wire, solid, halo, hit);
    if (m.boss) g.scale.setScalar(1.45);
    group.add(g);

    // DOM label
    const lab = document.createElement('div');
    lab.className = 'plabel';
    lab.innerHTML = `<b>${pad(m.n)}</b><span class="t">${m.title}</span><span class="more">${m.year} · ${m.skills.map((s) => s.name).slice(0, 3).join(' · ')}</span>`;
    document.getElementById('labels').appendChild(lab);
    portals.push({ m, g, ringA, ringB, wire, solid, halo, hit, ringMat, lab, hover: 0, cleared: false, locked: false, next: false });
  });

  // ---- journey path (flowing pulse along a spline through all portals) ----
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(2.4, 0, 0.5), ...pts], false, 'catmullrom', 0.5);
  const SEG = 320;
  const cp = curve.getPoints(SEG);
  const pathGeo = new THREE.BufferGeometry().setFromPoints(cp);
  pathGeo.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(cp.map((_, i) => i / SEG)), 1));
  const path = new THREE.Line(pathGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: globalU.uTime, uDone: { value: 0 } },
    vertexShader: /* glsl */ `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      varying float vT; uniform float uTime, uDone;
      void main(){
        float pulse = smoothstep(.06, 0., abs(fract(vT * 2. - uTime * .08) - .5) - .44);
        float done = step(vT, uDone);
        vec3 c = mix(vec3(.25,.45,1.), vec3(.3,1.,.8), done);
        float a = .14 + pulse * .8 + done * .3;
        gl_FragColor = vec4(c * (1. + pulse * 2.), a);
      }`,
  }));
  group.add(path);

  // ---- state ----
  let visible = false;
  let blocked = false;       // a modal panel is open
  let diving = false;
  let hovered = -1;
  let coreHover = false;
  let coreClicks = 0;
  let spin = 0.05;
  let tilt = 0.12, tiltTarget = 0.12;
  let dragDist = 0;
  const look = new THREE.Vector3();
  const camBase = new THREE.Vector3(0, 2.6, 16.5);
  const par = new THREE.Vector2();
  const shardKeys = new Set();
  let godApplied = false;

  function camDist() { const a = window.innerWidth / window.innerHeight; return a >= 1.4 ? 16.5 : 16.5 * Math.min(2.0, 1.4 / a); }
  onResize(() => { camBase.z = camDist(); });

  function nextIndex() {
    for (let i = 0; i < missions.length; i++) if (!store.isCleared(missions[i].id) && !isLocked(i)) return i;
    return -1;
  }
  function isLocked(i) {
    if (store.state.god) return false;
    if (!missions[i].boss) return false;
    return missions.filter((m) => !m.boss).some((m) => !store.isCleared(m.id));
  }

  function refresh() {
    const ni = nextIndex();
    let doneRatio = 0;
    portals.forEach((p, i) => {
      p.cleared = store.isCleared(p.m.id);
      p.locked = isLocked(i);
      p.next = i === ni;
      p.solid.material.opacity = p.cleared ? 1 : 0;
      p.wire.visible = !p.cleared;
      p.halo.material.opacity = p.cleared ? 0.6 : p.locked ? 0.08 : p.next ? 0.55 : 0.28;
      p.ringMat.opacity = p.locked ? 0.25 : 0.95;
      if (p.cleared) doneRatio = Math.max(doneRatio, (i + 1) / missions.length);
    });
    path.material.uniforms.uDone.value = Math.min(1, store.clearedCount() / missions.length * 0.92);
    const prog = store.state.god ? 1 : store.clearedCount() / missions.length;
    core.setProgress(0.1 + prog * 0.9);
    coreU.uGod.value = store.state.god ? 1 : 0;
    // shards for already-cleared missions (instant)
    const wanted = [];
    missions.forEach((m) => { if (store.state.god || store.isCleared(m.id)) m.skills.forEach((s) => wanted.push([m, s])); });
    for (const [m, s] of wanted) {
      const k = m.id + ':' + s.name;
      if (!shardKeys.has(k)) { shardKeys.add(k); core.addShard(catIndex(s.cat), true); }
    }
    godApplied = !!store.state.god;
    return { next: ni };
  }

  function portalWorld(i) { return portals[i].g.getWorldPosition(new THREE.Vector3()); }

  /** After a mission is cleared: fly the mission's skill shards into the Core. */
  function awardShards(m) {
    const from = portalWorld(missions.indexOf(m));
    audio.sfx.shard();
    core.pulse(1.1);
    fx.ring(core.group.getWorldPosition(new THREE.Vector3()), 0x7fd8ff, 9, 1.4);
    m.skills.forEach((s, k) => {
      const key = m.id + ':' + s.name;
      if (shardKeys.has(key)) return;
      shardKeys.add(key);
      gsap.delayedCall(k * 0.18, () => core.addShard(catIndex(s.cat), false, from));
    });
  }

  function worldToScreen(v) {
    const p = v.clone().project(camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, z: p.z };
  }

  function click() {
    if (hovered >= 0) {
      const p = portals[hovered];
      if (p.locked) { audio.sfx.error(); fx.shake(0.15, 0.25); onToast('🔒 Boss locked. Clear missions 01–09 first.'); return; }
      audio.sfx.click();
      onSelect(hovered);
    } else if (coreHover) {
      coreClicks++;
      core.pulse(0.8 + Math.min(coreClicks, 6) * 0.1);
      audio.sfx.coin();
      fx.ring(core.group.getWorldPosition(new THREE.Vector3()), 0x9fd8ff, 7, 0.9);
      if (coreClicks % 5 === 0) onToast(facts[(coreClicks / 5 - 1) % facts.length]);
    }
  }

  const tmpV = new THREE.Vector3();
  function update(dt, t) {
    if (!visible) return;
    core.update(dt, t);

    // drag to rotate
    if (input.pressed) dragDist = 0;
    if (input.down && !blocked && !diving) {
      dragDist += Math.abs(input.dx) + Math.abs(input.dy);
      group.rotation.y += input.dx * 0.0055;
      tiltTarget = THREE.MathUtils.clamp(tiltTarget + input.dy * 0.0025, -0.15, 0.55);
      spin = THREE.MathUtils.lerp(spin, (input.dx * 0.0055) / Math.max(dt, 0.001), 0.25);
    } else {
      spin += (0.06 - spin) * (1 - Math.pow(0.12, dt));
      group.rotation.y += spin * dt;
    }
    tilt += (tiltTarget - tilt) * (1 - Math.pow(0.001, dt));
    group.rotation.x = tilt;
    if (input.wheel && !blocked) camBase.z = THREE.MathUtils.clamp(camBase.z + input.wheel * 0.01, 11, 24);

    // hover picking
    if (!blocked && !diving && !(input.down && dragDist > 8)) {
      const hit = pick([...portals.map((p) => p.hit), coreHit]);
      const hp = hit && hit.object.userData.portal != null ? hit.object.userData.portal : -1;
      const ch = !!(hit && hit.object.userData.core);
      if (hp !== hovered) { hovered = hp; if (hp >= 0) audio.sfx.hover(); }
      coreHover = ch;
    } else { hovered = -1; coreHover = false; }
    document.body.style.cursor = (hovered >= 0 || coreHover) && !blocked ? 'pointer' : input.down && dragDist > 8 ? 'grabbing' : 'grab';
    coreU.uHover.value += ((coreHover ? 1 : 0) - coreU.uHover.value) * 0.15;
    if (input.released && dragDist < 8 && !blocked && !diving) click();

    // portals
    portals.forEach((p, i) => {
      const targetH = i === hovered ? 1 : 0;
      p.hover += (targetH - p.hover) * (1 - Math.pow(0.0005, dt));
      const s = (p.m.boss ? 1.45 : 1) * (1 + p.hover * 0.28);
      p.g.scale.setScalar(s);
      p.ringA.rotation.x += dt * (0.6 + p.hover * 2); p.ringA.rotation.y += dt * 0.4;
      p.ringB.rotation.y -= dt * (0.8 + p.hover * 2); p.ringB.rotation.z += dt * 0.5;
      p.wire.rotation.y += dt * 0.7; p.solid.rotation.y -= dt * 0.9;
      p.g.position.y = pts[i].y + Math.sin(t * 0.8 + i) * 0.12;
      const base = p.cleared ? 0.6 : p.locked ? 0.08 : p.next ? 0.55 + Math.sin(t * 3) * 0.2 : 0.28;
      p.halo.material.opacity = base + p.hover * 0.35;
      p.halo.scale.setScalar(3.4 + (p.next ? Math.sin(t * 3) * 0.5 : 0));
      if (p.next && Math.floor(t * 0.5) !== Math.floor((t - dt) * 0.5)) fx.ring(p.g.getWorldPosition(tmpV), p.m.color, 2.4, 1.1);
    });

    // camera (parallax + look)
    if (!diving) {
      par.x += (input.ndc.x - par.x) * (1 - Math.pow(0.02, dt));
      par.y += (input.ndc.y - par.y) * (1 - Math.pow(0.02, dt));
      camera.position.set(par.x * 1.4, camBase.y + par.y * 0.8, camBase.z);
      look.set(0, 0, 0);
      camera.lookAt(look);
    }

    // labels
    const ni = nextIndex();
    portals.forEach((p, i) => {
      p.g.getWorldPosition(tmpV);
      const sp = worldToScreen(tmpV);
      const dist = camera.position.distanceTo(tmpV);
      const depthFade = THREE.MathUtils.clamp(1.25 - (dist - camBase.z + 8) / 18, 0.3, 1);
      p.lab.style.transform = `translate3d(${sp.x}px, ${sp.y + 36 * (p.m.boss ? 1.4 : 1)}px, 0) translate(-50%, 0)`;
      p.lab.style.opacity = blocked || diving ? 0 : depthFade;
      p.lab.style.zIndex = Math.round(depthFade * 100);
      p.lab.classList.toggle('hover', i === hovered);
      p.lab.classList.toggle('cleared', p.cleared);
      p.lab.classList.toggle('locked', p.locked);
      p.lab.classList.toggle('next', i === ni);
      p.lab.style.setProperty('--c', p.m.color);
    });
  }
  onFrame(update);

  return {
    root, core, portals,
    refresh, awardShards, portalWorld, nextIndex,
    get hovered() { return hovered; },
    set blocked(v) { blocked = v; },
    get blocked() { return blocked; },
    show() {
      visible = true; root.visible = true;
      setNebula('#2a1466', '#0b6e8a', 0.55);
      camera.fov = 50; camera.updateProjectionMatrix();
      camBase.z = camDist();
      document.getElementById('labels').style.display = '';
      streaks.material.uniforms.uTint.value.set('#9fd8ff');
    },
    hide() { visible = false; root.visible = false; document.getElementById('labels').style.display = 'none'; document.body.style.cursor = ''; },
    /** Camera flies into portal i with a warp. Resolves when it's time to start the mission. */
    dive(i) {
      diving = true;
      audio.sfx.warp();
      const target = portalWorld(i);
      const dir = camera.position.clone().sub(target).normalize();
      const end = target.clone().add(dir.multiplyScalar(1.1));
      look.copy(target);
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: () => { diving = false; resolve(); } });
        tl.to(camera.position, { x: end.x, y: end.y, z: end.z, duration: 1.05, ease: 'power3.in', onUpdate: () => camera.lookAt(target) }, 0);
        tl.to(camera, { fov: 95, duration: 1.05, ease: 'power3.in', onUpdate: () => camera.updateProjectionMatrix() }, 0);
        tl.to(globalU.uWarp, { value: 1, duration: 0.95, ease: 'power2.in' }, 0.1);
        tl.add(() => fx.flash(portals[i].m.color, 0.7), 0.95);
      });
    },
    /** Called when returning from a mission. */
    settle() {
      camera.fov = 50; camera.updateProjectionMatrix();
      camera.position.set(0, camBase.y, camBase.z);
      globalU.uWarp.value = 1;
      gsap.to(globalU.uWarp, { value: 0, duration: 1.1, ease: 'power3.out' });
      document.body.style.cursor = 'grab';
    },
    shift(x, dur = 0.9) { gsap.to(root.position, { x, duration: dur, ease: 'power3.inOut' }); },
    get godApplied() { return godApplied; },
  };
}
