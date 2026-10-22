import * as THREE from 'three';
import { scene, camera, onFrame, globalU } from '../engine/renderer.js';
import { input } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite } from '../engine/helpers.js';
import { missions, projects } from '../data/content.js';
import { store } from '../engine/store.js';
import { setNebula } from './background.js';

const pad = (n) => String(n).padStart(2, '0');

export function createDriveWorld({ onPlayMission, onInspectMission }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ── Ground Grid & Neon Circuit Road ──
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: globalU.uTime },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP; uniform float uTime;
      void main(){
        vec2 p = vP * 0.25;
        vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        // oval circuit ring highlight
        float r = length(vP * vec2(0.75, 1.0));
        float road = smoothstep(3.2, 0.0, abs(r - 24.0));
        float fade = smoothstep(85.0, 12.0, length(vP));
        vec3 col = mix(vec3(0.08, 0.45, 0.85), vec3(0.15, 0.95, 0.72), road);
        float a = (line * 0.38 + road * 0.16) * fade;
        gl_FragColor = vec4(col * 1.6 * a, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), gridMat);
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // Center monument spire
  const spireGroup = new THREE.Group();
  const spireGeo = new THREE.OctahedronGeometry(2.2, 0);
  spireGeo.scale(0.8, 2.2, 0.8);
  const spireMesh = new THREE.Mesh(spireGeo, bodyMat('#0b1636', 0.9));
  const spireEdge = edgeLines(spireGeo, '#22e4ff', 2.0);
  const spireHalo = glowSprite('#22e4ff', 8, 0.45);
  spireGroup.add(spireMesh, spireEdge, spireHalo);
  spireGroup.position.set(0, 3.2, 0);
  root.add(spireGroup);
  const spireTitle = textSprite('SAKSHAM // HORIZON CIRCUIT', {
    worldH: 0.9, width: 900, height: 110, font: '700 44px "JetBrains Mono"', color: '#22e4ff',
  });
  spireTitle.sprite.position.set(0, 7.2, 0);
  root.add(spireTitle.sprite);

  // ── 10 Mission Drive-ThruGates along the oval track ──
  const gates = [];
  missions.forEach((m, i) => {
    const ang = (i / missions.length) * Math.PI * 2 - Math.PI / 2;
    const rx = 31, rz = 23;
    const x = Math.cos(ang) * rx;
    const z = Math.sin(ang) * rz;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -ang;

    const archGeo = new THREE.TorusGeometry(2.4, 0.09, 10, 48, Math.PI);
    const arch = new THREE.Mesh(archGeo, glowMat(m.color, 1.8));
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.25, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, opacity: 0.75, toneMapped: false }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.04;

    const lbl = textSprite(`${pad(m.n)} · ${m.title.toUpperCase()}`, {
      worldH: 0.65, width: 680, height: 96, font: '700 42px "JetBrains Mono"', color: '#ffffff',
    });
    lbl.sprite.position.set(0, 3.15, 0);
    const subLbl = textSprite(m.year, {
      worldH: 0.42, width: 360, height: 72, font: '600 32px "JetBrains Mono"', color: m.color,
    });
    subLbl.sprite.position.set(0, 2.5, 0);

    g.add(arch, padRing, lbl.sprite, subLbl.sprite);
    root.add(g);
    gates.push({ m, i, g, padRing, pos: new THREE.Vector3(x, 0, z) });
  });

  // ── Knockable Bruno-Simon-style Cyber Blocks & Boost Pads ──
  const crates = [];
  const crateGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + 0.15;
    const r = 13 + (i % 3) * 4.5;
    const cGroup = new THREE.Group();
    const col = ['#22e4ff', '#3dffb5', '#ffc23d', '#ff4fa3'][i % 4];
    cGroup.add(new THREE.Mesh(crateGeo, bodyMat('#0d1630', 0.92)));
    cGroup.add(edgeLines(crateGeo, col, 1.6));
    cGroup.position.set(Math.cos(a) * r, 0.45, Math.sin(a) * r);
    root.add(cGroup);
    crates.push({ g: cGroup, vx: 0, vy: 0, vz: 0, col, hitCooldown: 0 });
  }

  // ── Project Roadside Billboards (inner ring) ──
  projects.slice(0, 6).forEach((p, i) => {
    const a = (i / 6) * Math.PI * 2;
    const bx = Math.cos(a) * 11.5, bz = Math.sin(a) * 9.5;
    const b = new THREE.Group();
    b.position.set(bx, 1.5, bz);
    b.lookAt(0, 1.5, 0);
    const boardGeo = new THREE.BoxGeometry(3.4, 1.4, 0.12);
    b.add(new THREE.Mesh(boardGeo, bodyMat('#081126', 0.92)));
    b.add(edgeLines(boardGeo, p.color, 1.6));
    const t = textSprite(p.name, { worldH: 0.45, width: 520, height: 84, font: '700 40px "JetBrains Mono"', color: '#ffffff' });
    t.sprite.position.set(0, 0.2, 0.12);
    const tag = textSprite(p.tag, { worldH: 0.3, width: 520, height: 64, font: '600 28px "JetBrains Mono"', color: p.color });
    tag.sprite.position.set(0, -0.28, 0.12);
    b.add(t.sprite, tag.sprite);
    root.add(b);
  });

  // ── Player Cyber-Supercar Mesh ──
  const car = new THREE.Group();
  car.position.set(0, 0, 22);
  car.rotation.y = Math.PI / 2;
  const bodyGeo = new THREE.BoxGeometry(1.35, 0.42, 2.7);
  const cabinGeo = new THREE.BoxGeometry(1.1, 0.34, 1.35);
  const carBody = new THREE.Mesh(bodyGeo, bodyMat('#0a1530', 0.96));
  carBody.position.y = 0.38;
  const carCabin = new THREE.Mesh(cabinGeo, bodyMat('#10224a', 0.92));
  carCabin.position.set(0, 0.72, -0.1);
  const carEdge = edgeLines(bodyGeo, '#22e4ff', 2.0);
  carEdge.position.y = 0.38;
  const cabinEdge = edgeLines(cabinGeo, '#3dffb5', 1.6);
  cabinEdge.position.copy(carCabin.position);

  // Headlights & Taillight strip
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 0.06), glowMat('#ff2a5f', 2.6));
  tailBar.position.set(0, 0.44, -1.36);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.06), glowMat('#22e4ff', 2.6));
  headL.position.set(-0.42, 0.4, 1.36);
  const headR = headL.clone();
  headR.position.x = 0.42;
  const underglow = glowSprite('#22e4ff', 3.4, 0.55);
  underglow.position.y = 0.08;
  car.add(carBody, carCabin, carEdge, cabinEdge, tailBar, headL, headR, underglow);
  root.add(car);

  // ── Forza Horizon Telemetry HUD + Touch Controls ──
  const hud = document.createElement('div');
  hud.className = 'drive-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none'; // Initially hidden
  hud.innerHTML = `
    <div class="drive-prompt" id="drive-prompt">
      <div class="dp-meta"><b id="dp-num">01</b><span id="dp-title">HELLO, WORLD</span></div>
      <div class="dp-btns">
        <button type="button" class="btn primary small" id="dp-play">▶ PLAY MISSION [E]</button>
        <button type="button" class="btn small" id="dp-read">📖 STORY & CERTS [R]</button>
      </div>
    </div>
    <div class="forza-dial">
      <div class="fd-top"><span class="fd-gear" id="fd-gear">1</span><div class="fd-spd"><b id="fd-kmh">000</b><em>KM/H</em></div></div>
      <div class="fd-rpm"><i id="fd-rpm-bar"></i></div>
      <div class="fd-sub"><span id="fd-drift">WASD / ARROWS · SPACE DRIFT · SHIFT NITRO</span></div>
    </div>
    <div class="drive-touch">
      <div class="dt-left">
        <button type="button" data-k="KeyA">◀</button>
        <button type="button" data-k="KeyD">▶</button>
      </div>
      <div class="dt-right">
        <button type="button" data-k="ShiftLeft" class="boost">NITRO</button>
        <button type="button" data-k="KeyS">BRAKE</button>
        <button type="button" data-k="KeyW" class="gas">GAS ▲</button>
      </div>
    </div>`;
  document.getElementById('ui').appendChild(hud);

  const touchKeys = new Set();
  hud.querySelectorAll('[data-k]').forEach((btn) => {
    const k = btn.dataset.k;
    const down = (e) => { e.preventDefault(); touchKeys.add(k); };
    const up = () => touchKeys.delete(k);
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  let activeGate = null;
  let speed = 0;
  let heading = Math.PI / 2;
  let driftScore = 0;
  let visible = false;
  let blocked = false;

  hud.querySelector('#dp-play').addEventListener('click', () => {
    if (activeGate) { audio.sfx.click(); onPlayMission(activeGate.i); }
  });
  hud.querySelector('#dp-read').addEventListener('click', () => {
    if (activeGate) { audio.sfx.click(); onInspectMission(activeGate.m); }
  });

  const kmhEl = hud.querySelector('#fd-kmh');
  const gearEl = hud.querySelector('#fd-gear');
  const rpmBar = hud.querySelector('#fd-rpm-bar');
  const driftEl = hud.querySelector('#fd-drift');
  const promptEl = hud.querySelector('#drive-prompt');
  const dpNum = hud.querySelector('#dp-num');
  const dpTitle = hud.querySelector('#dp-title');

  onFrame((dt, t) => {
    if (!visible || blocked) return;
    spireGroup.rotation.y += dt * 0.6;

    const kd = (c) => input.keysDown.has(c) || touchKeys.has(c);
    const gas = kd('KeyW') || kd('ArrowUp');
    const brk = kd('KeyS') || kd('ArrowDown');
    const left = kd('KeyA') || kd('ArrowLeft');
    const right = kd('KeyD') || kd('ArrowRight');
    const boost = kd('ShiftLeft') || kd('ShiftRight');
    const handbrake = kd('Space');

    const maxSpd = boost ? 32 : 21;
    const accel = boost ? 26 : 16;
    if (gas) speed += accel * dt;
    else if (brk) speed -= 18 * dt;
    else speed *= Math.pow(0.22, dt);
    speed = THREE.MathUtils.clamp(speed, -10, maxSpd);

    const turnRate = (handbrake ? 3.2 : 2.2) * Math.min(1, Math.abs(speed) / 4);
    const dirSign = speed >= -0.1 ? 1 : -1;
    if (left) heading += turnRate * dt * dirSign;
    if (right) heading -= turnRate * dt * dirSign;

    car.rotation.y = heading;
    // Slight body roll on steering
    const targetRoll = (left ? 0.08 : right ? -0.08 : 0) * Math.min(1, Math.abs(speed) / 10);
    carBody.rotation.z += (targetRoll - carBody.rotation.z) * 0.2;

    const vx = Math.sin(heading) * speed;
    const vz = Math.cos(heading) * speed;
    car.position.x = THREE.MathUtils.clamp(car.position.x + vx * dt, -55, 55);
    car.position.z = THREE.MathUtils.clamp(car.position.z + vz * dt, -55, 55);

    // Exhaust & drift particles
    if (Math.abs(speed) > 2) {
      const back = new THREE.Vector3(
        car.position.x - Math.sin(heading) * 1.4,
        0.25,
        car.position.z - Math.cos(heading) * 1.4,
      );
      if (boost && Math.random() < 0.85) {
        fx.burst(back, '#22e4ff', 2, 3.5, 0.22, 0.35);
      } else if (Math.random() < 0.45) {
        fx.burst(back, '#3dffb5', 1, 1.5, 0.14, 0.28);
      }
      if ((handbrake || (left || right) && Math.abs(speed) > 14) && Math.random() < 0.7) {
        driftScore += Math.round(Math.abs(speed) * dt * 12);
        fx.burst(back, '#ffc23d', 2, 2.2, 0.18, 0.4);
      }
    }

    // Crate physics collisions
    for (const c of crates) {
      if (c.hitCooldown > 0) c.hitCooldown -= dt;
      const dx = c.g.position.x - car.position.x;
      const dz = c.g.position.z - car.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.55 && c.hitCooldown <= 0 && Math.abs(speed) > 1.5) {
        c.hitCooldown = 0.4;
        const push = Math.max(8, Math.abs(speed) * 1.1);
        c.vx = (dx / (d || 1)) * push;
        c.vz = (dz / (d || 1)) * push;
        c.vy = 5.5;
        audio.sfx.hit();
        fx.burst(c.g.position.clone(), c.col, 18, 5, 0.18, 0.6);
        store.state.xp += 5;
      }
      if (Math.abs(c.vx) > 0.05 || Math.abs(c.vz) > 0.05 || c.g.position.y > 0.45) {
        c.g.position.x += c.vx * dt;
        c.g.position.z += c.vz * dt;
        c.g.position.y += c.vy * dt;
        c.vy -= 14 * dt;
        c.g.rotation.x += c.vz * dt * 0.5;
        c.g.rotation.z -= c.vx * dt * 0.5;
        if (c.g.position.y <= 0.45) {
          c.g.position.y = 0.45;
          c.vy = 0;
          c.vx *= 0.85;
          c.vz *= 0.85;
        }
      }
    }

    // Smooth chase camera
    const camTarget = new THREE.Vector3(
      car.position.x - Math.sin(heading) * 7.8,
      3.8 + Math.min(1.2, Math.abs(speed) * 0.04),
      car.position.z - Math.cos(heading) * 7.8,
    );
    camera.position.lerp(camTarget, 1 - Math.pow(0.002, dt));
    camera.lookAt(car.position.x + Math.sin(heading) * 3, 0.9, car.position.z + Math.cos(heading) * 3);

    // Check proximity to Mission Gates
    let nearest = null;
    let bestD = 4.2;
    for (const gt of gates) {
      gt.padRing.rotation.z = t * 0.8;
      const d = car.position.distanceTo(gt.pos);
      if (d < bestD) { bestD = d; nearest = gt; }
    }
    if (nearest !== activeGate) {
      activeGate = nearest;
      if (activeGate) {
        audio.sfx.hover();
        dpNum.textContent = pad(activeGate.m.n);
        dpTitle.textContent = activeGate.m.title.toUpperCase();
        promptEl.classList.add('open');
      } else {
        promptEl.classList.remove('open');
      }
    }

    if (activeGate) {
      if (input.keysPressed.has('KeyE') || input.keysPressed.has('Enter')) {
        audio.sfx.click();
        onPlayMission(activeGate.i);
      } else if (input.keysPressed.has('KeyR')) {
        audio.sfx.click();
        onInspectMission(activeGate.m);
      }
    }

    // Update Forza Speedometer HUD
    const kmh = Math.round(Math.abs(speed) * 7.2);
    kmhEl.textContent = String(kmh).padStart(3, '0');
    const gear = kmh < 3 ? 'N' : Math.min(6, Math.floor(kmh / 35) + 1);
    gearEl.textContent = gear;
    const rpm = kmh < 3 ? 0.12 : ((kmh % 35) / 35) * 0.75 + 0.25;
    rpmBar.style.transform = `scaleX(${ Math.min(1, rpm).toFixed(2) })`;
    if (driftScore > 0) {
      driftEl.textContent = `🔥 DRIFT SKILL SCORE: +${driftScore} XP · DRIVE INTO ANY ARCH`;
    }
  });

  return {
    show() {
      visible = true;
      root.visible = true;
      hud.style.display = 'block';
      hud.classList.add('open');
      setNebula('#0d1f44', '#084c61', 0.58);
      document.body.style.cursor = 'default';
    },
    hide() {
      visible = false;
      root.visible = false;
      hud.style.display = 'none';
      hud.classList.remove('open');
      promptEl.classList.remove('open');
      touchKeys.clear();
    },
    refresh() {
      gates.forEach((gt) => {
        const clr = store.isCleared(gt.m.id);
        gt.padRing.material.color.set(clr ? '#3dffb5' : gt.m.color);
      });
    },
    set blocked(v) { blocked = v; },
  };
}
