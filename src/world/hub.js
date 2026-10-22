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

export function createHub({ onSelect, onInspect, onToast }) {
  const root = new THREE.Group();
  const group = new THREE.Group();
  root.add(group);
  scene.add(root);

  const core = createCore();
  group.add(core.group);
  const coreHit = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
  coreHit.userData.core = true;
  group.add(coreHit);

  // ---- Solar System Planetary Layout: well-distanced rings + 360° angular separation ----
  const portals = [];
  const pts = [];
  missions.forEach((m, i) => {
    // Even 36-degree spacing around the circle + progressive orbital radius so planets never crowd
    const ang = (i / missions.length) * Math.PI * 2 - Math.PI / 2;
    const rad = 6.8 + i * 0.85;
    const y = Math.sin(i * 1.35) * 1.45;
    const p = new THREE.Vector3(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
    pts.push(p.clone());

    const color = new THREE.Color(m.color);

    // Subtle planetary orbit track ring around the Core
    const orbitGeo = new THREE.RingGeometry(rad - 0.022, rad + 0.022, 112);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(0.9),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
      toneMapped: false,
      depthWrite: false,
    });
    const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
    orbitMesh.rotation.x = Math.PI / 2;
    orbitMesh.position.y = y * 0.25;
    group.add(orbitMesh);

    const g = new THREE.Group();
    g.position.copy(p);
    const ringMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), toneMapped: false, transparent: true, opacity: 0.95 });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.04, 12, 72), ringMat);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.028, 12, 64), ringMat);
    const orbGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const wire = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.8), wireframe: true, toneMapped: false }));
    const solid = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0 }));
    const halo = glowSprite(m.color, 4.0, 0.32);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.65, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.portal = i;
    g.add(ringA, ringB, wire, solid, halo, hit);
    if (m.boss) g.scale.setScalar(1.35);
    group.add(g);

    // Minimalist clickable DOM label below planet
    const lab = document.createElement('div');
    lab.className = 'plabel';
    lab.setAttribute('data-ui', '');
    lab.innerHTML = `<div class="pl-top"><b>${pad(m.n)}</b><span class="t">${m.title}</span></div>`;
    lab.addEventListener('pointerenter', () => {
      if (!blocked && !diving) { hovered = i; audio.sfx.hover(); }
    });
    lab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (blocked || diving) return;
      audio.sfx.click();
      onSelect(i);
    });
    document.getElementById('labels').appendChild(lab);
    portals.push({ m, i, ang, rad, g, ringA, ringB, wire, solid, halo, hit, ringMat, orbitMat, lab, hover: 0, cleared: false, locked: false, next: false });
  });

  // ---- Minimalist Solar Chapter Bar (Compact 01..10 pills, expands title on hover) ----
  const solarBar = document.createElement('div');
  solarBar.className = 'solar-bar';
  solarBar.setAttribute('data-ui', '');
  solarBar.innerHTML = `
    <span class="sb-lbl">CHAPTER</span>
    <div class="sb-list">
      ${missions.map((m, i) => `
        <button type="button" class="sb-pill" data-idx="${i}" style="--c:${m.color}" title="${pad(m.n)} · ${m.title} (${m.year})">
          <b>${pad(m.n)}</b><span>${m.title}</span>
        </button>`).join('')}
    </div>`;
  document.getElementById('ui').appendChild(solarBar);

  solarBar.querySelectorAll('.sb-pill').forEach((btn) => {
    const idx = Number(btn.dataset.idx);
    btn.addEventListener('pointerenter', () => {
      if (blocked || diving) return;
      hovered = idx;
      audio.sfx.hover();
      // Smoothly rotate solar system so this planet is right in front of the camera
      const targetRot = -portals[idx].ang + Math.PI / 2;
      gsap.to(group.rotation, { y: targetRot, duration: 0.75, ease: 'power3.out' });
    });
    btn.addEventListener('click', () => {
      if (blocked || diving) return;
      audio.sfx.click();
      onSelect(idx);
    });
  });

  // ---- Constellation path connecting missions ----
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(2.4, 0, 0.5), ...pts], false, 'catmullrom', 0.5);
  const SEG = 360;
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
        float a = .11 + pulse * .65 + done * .24;
        gl_FragColor = vec4(c * (1. + pulse * 1.8), a);
      }`,
  }));
  group.add(path);

  // ---- state ----
  let visible = false;
  let blocked = false;
  let diving = false;
  let hovered = -1;
  let coreHover = false;
  let coreClicks = 0;
  let spin = 0.035;
  let tilt = 0.24, tiltTarget = 0.24;
  let dragDist = 0;
  const look = new THREE.Vector3();
  const camBase = new THREE.Vector3(0, 4.2, 22.5);
  const par = new THREE.Vector2();
  const shardKeys = new Set();
  let godApplied = false;

  function camDist() { const a = window.innerWidth / window.innerHeight; return a >= 1.4 ? 22.5 : 22.5 * Math.min(1.9, 1.4 / a); }
  onResize(() => { camBase.z = camDist(); });

  function nextIndex() {
    for (let i = 0; i < missions.length; i++) if (!store.isCleared(missions[i].id)) return i;
    return -1;
  }

  function refresh() {
    const ni = nextIndex();
    portals.forEach((p, i) => {
      p.cleared = store.isCleared(p.m.id);
      p.locked = false; // All missions accessible anytime!
      p.next = i === ni;
      p.solid.material.opacity = p.cleared ? 1 : 0;
      p.wire.visible = !p.cleared;
      p.halo.material.opacity = p.cleared ? 0.65 : p.next ? 0.58 : 0.32;
      p.ringMat.opacity = 0.95;
      p.orbitMat.opacity = p.cleared ? 0.28 : p.next ? 0.24 : 0.12;
    });
    solarBar.querySelectorAll('.sb-pill').forEach((btn, i) => {
      btn.classList.toggle('cleared', portals[i].cleared);
      btn.classList.toggle('next', i === ni);
    });
    path.material.uniforms.uDone.value = Math.min(1, (store.clearedCount() / missions.length) * 0.95);
    const prog = store.state.god ? 1 : store.clearedCount() / missions.length;
    core.setProgress(0.1 + prog * 0.9);
    coreU.uGod.value = store.state.god ? 1 : 0;

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
      audio.sfx.click();
      onSelect(hovered);
    } else if (coreHover) {
      coreClicks++;
      core.pulse(0.8 + Math.min(coreClicks, 6) * 0.1);
      audio.sfx.coin();
      fx.ring(core.group.getWorldPosition(new THREE.Vector3()), 0x9fd8ff, 7, 0.9);
      if (coreClicks % 3 === 0) onToast(facts[(coreClicks / 3 - 1) % facts.length]);
    }
  }

  const tmpV = new THREE.Vector3();
  function update(dt, t) {
    if (!visible) return;
    core.update(dt, t);

    // Drag to rotate solar system
    if (input.pressed) dragDist = 0;
    if (input.down && !blocked && !diving) {
      dragDist += Math.abs(input.dx) + Math.abs(input.dy);
      group.rotation.y += input.dx * 0.0055;
      tiltTarget = THREE.MathUtils.clamp(tiltTarget + input.dy * 0.0025, -0.05, 0.65);
      spin = THREE.MathUtils.lerp(spin, (input.dx * 0.0055) / Math.max(dt, 0.001), 0.25);
    } else {
      spin += (0.032 - spin) * (1 - Math.pow(0.12, dt));
      group.rotation.y += spin * dt;
    }
    tilt += (tiltTarget - tilt) * (1 - Math.pow(0.001, dt));
    group.rotation.x = tilt;
    if (input.wheel && !blocked) camBase.z = THREE.MathUtils.clamp(camBase.z + input.wheel * 0.012, 12, 32);

    // Hover picking in 3D
    if (!blocked && !diving && !(input.down && dragDist > 8)) {
      const hit = pick([...portals.map((p) => p.hit), coreHit]);
      const hp = hit && hit.object.userData.portal != null ? hit.object.userData.portal : -1;
      const ch = !!(hit && hit.object.userData.core);
      if (hp >= 0 && hp !== hovered) { hovered = hp; audio.sfx.hover(); }
      else if (hp < 0 && !portals.some((p) => p.lab.matches(':hover'))) { hovered = -1; }
      coreHover = ch;
    } else if (blocked || diving) {
      hovered = -1; coreHover = false;
    }
    document.body.style.cursor = (hovered >= 0 || coreHover) && !blocked ? 'pointer' : input.down && dragDist > 8 ? 'grabbing' : 'grab';
    coreU.uHover.value += ((coreHover ? 1 : 0) - coreU.uHover.value) * 0.15;
    if (input.released && dragDist < 8 && !blocked && !diving) click();

    // Animate planets
    portals.forEach((p, i) => {
      const targetH = i === hovered ? 1 : 0;
      p.hover += (targetH - p.hover) * (1 - Math.pow(0.0005, dt));
      const s = (p.m.boss ? 1.35 : 1) * (1 + p.hover * 0.32);
      p.g.scale.setScalar(s);
      p.ringA.rotation.x += dt * (0.6 + p.hover * 2); p.ringA.rotation.y += dt * 0.4;
      p.ringB.rotation.y -= dt * (0.8 + p.hover * 2); p.ringB.rotation.z += dt * 0.5;
      p.wire.rotation.y += dt * 0.7; p.solid.rotation.y -= dt * 0.9;
      p.g.position.y = pts[i].y + Math.sin(t * 0.8 + i) * 0.14;
      const base = p.cleared ? 0.65 : p.next ? 0.55 + Math.sin(t * 3) * 0.2 : 0.32;
      p.halo.material.opacity = base + p.hover * 0.35;
      p.halo.scale.setScalar(4.0 + (p.next ? Math.sin(t * 3) * 0.5 : 0));
      if (p.next && Math.floor(t * 0.5) !== Math.floor((t - dt) * 0.5)) fx.ring(p.g.getWorldPosition(tmpV), p.m.color, 2.6, 1.1);
    });

    // Camera parallax
    if (!diving) {
      par.x += (input.ndc.x - par.x) * (1 - Math.pow(0.02, dt));
      par.y += (input.ndc.y - par.y) * (1 - Math.pow(0.02, dt));
      camera.position.set(par.x * 1.5, camBase.y + par.y * 0.8, camBase.z);
      look.set(0, -0.3, 0);
      camera.lookAt(look);
    }

    // Update HTML labels
    const ni = nextIndex();
    portals.forEach((p, i) => {
      p.g.getWorldPosition(tmpV);
      const sp = worldToScreen(tmpV);
      if (sp.z > 1) {
        p.lab.style.opacity = 0;
        return;
      }
      const dist = camera.position.distanceTo(tmpV);
      const depthFade = THREE.MathUtils.clamp(1.3 - (dist - camBase.z + 10) / 24, 0.45, 1);
      p.lab.style.transform = `translate3d(${sp.x}px, ${sp.y + 38 * (p.m.boss ? 1.3 : 1)}px, 0) translate(-50%, 0)`;
      p.lab.style.opacity = blocked || diving ? 0 : depthFade;
      p.lab.style.pointerEvents = blocked || diving ? 'none' : 'auto';
      p.lab.style.zIndex = Math.round(depthFade * 100) + (i === hovered ? 50 : 0);
      p.lab.classList.toggle('hover', i === hovered);
      p.lab.classList.toggle('cleared', p.cleared);
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
      document.getElementById('labels').style.display = 'block';
      solarBar.classList.add('open');
      streaks.material.uniforms.uTint.value.set('#9fd8ff');
    },
    hide() {
      visible = false; root.visible = false;
      document.getElementById('labels').style.display = 'none';
      solarBar.classList.remove('open');
      document.body.style.cursor = '';
    },
    dive(i) {
      diving = true;
      audio.sfx.warp();
      const target = portalWorld(i);
      const dir = camera.position.clone().sub(target).normalize();
      const end = target.clone().add(dir.multiplyScalar(1.1));
      look.copy(target);
      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: () => { diving = false; resolve(); } });
        tl.to(camera.position, { x: end.x, y: end.y, z: end.z, duration: 0.95, ease: 'power3.in', onUpdate: () => camera.lookAt(target) }, 0);
        tl.to(camera, { fov: 92, duration: 0.95, ease: 'power3.in', onUpdate: () => camera.updateProjectionMatrix() }, 0);
        tl.to(globalU.uWarp, { value: 0.9, duration: 0.85, ease: 'power2.in' }, 0.1);
        tl.add(() => fx.flash(portals[i].m.color, 0.14), 0.85);
      });
    },
    settle() {
      camera.fov = 50; camera.updateProjectionMatrix();
      camera.position.set(0, camBase.y, camBase.z);
      globalU.uWarp.value = 0.8;
      gsap.to(globalU.uWarp, { value: 0, duration: 0.9, ease: 'power3.out' });
      document.body.style.cursor = 'grab';
    },
    shift(x, dur = 0.8) { gsap.to(root.position, { x, duration: dur, ease: 'power3.inOut' }); },
    get godApplied() { return godApplied; },
  };
}
