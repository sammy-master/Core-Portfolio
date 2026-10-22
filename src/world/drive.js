import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, onFrame, globalU } from '../engine/renderer.js';
import { input } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite } from '../engine/helpers.js';
import { missions, projects } from '../data/content.js';
import { store } from '../engine/store.js';
import { setNebula } from './background.js';

const pad = (n) => String(n).padStart(2, '0');

export function createDriveWorld({ onPlayMission, onSelectMission, onInspectMission, onToast }) {
  const playMission = onPlayMission || onSelectMission || (() => {});
  const inspectMission = onInspectMission || (() => {});

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
        float r = length(vP * vec2(0.75, 1.0));
        float road = smoothstep(3.6, 0.0, abs(r - 24.0));
        float fade = smoothstep(88.0, 12.0, length(vP));
        vec3 col = mix(vec3(0.08, 0.45, 0.85), vec3(0.15, 0.95, 0.72), road);
        float a = (line * 0.36 + road * 0.2) * fade;
        gl_FragColor = vec4(col * 1.5 * a, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), gridMat);
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // Center Monument Spire
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

  // ── 10 Mission Drive-Thru Gates along the oval track ──
  const gates = [];
  missions.forEach((m, i) => {
    const ang = (i / missions.length) * Math.PI * 2 - Math.PI / 2;
    const rx = 32, rz = 24;
    const x = Math.cos(ang) * rx;
    const z = Math.sin(ang) * rz;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = -ang;

    const archGeo = new THREE.TorusGeometry(2.6, 0.1, 10, 48, Math.PI);
    const arch = new THREE.Mesh(archGeo, glowMat(m.color, 1.8));
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(2.0, 2.4, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(1.6), side: THREE.DoubleSide, transparent: true, opacity: 0.78, toneMapped: false }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.04;

    const lbl = textSprite(`${pad(m.n)} · ${m.title.toUpperCase()}`, {
      worldH: 0.68, width: 700, height: 96, font: '700 42px "JetBrains Mono"', color: '#ffffff',
    });
    lbl.sprite.position.set(0, 3.3, 0);
    const subLbl = textSprite(m.year, {
      worldH: 0.44, width: 360, height: 72, font: '600 32px "JetBrains Mono"', color: m.color,
    });
    subLbl.sprite.position.set(0, 2.6, 0);

    g.add(arch, padRing, lbl.sprite, subLbl.sprite);
    root.add(g);
    gates.push({ m, i, ang, g, padRing, pos: new THREE.Vector3(x, 0, z) });
  });

  // ── 4 Glowing Nitro Boost Pads on the Track ──
  const boostPads = [];
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(ang) * 28, bz = Math.sin(ang) * 20;
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.05, bz);
    bGroup.rotation.y = -ang;
    const padGeo = new THREE.PlaneGeometry(2.8, 4.2);
    const padMat = new THREE.MeshBasicMaterial({ color: 0xffc23d, side: THREE.DoubleSide, transparent: true, opacity: 0.55, toneMapped: false });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.rotation.x = -Math.PI / 2;
    const bLbl = textSprite('⚡ NITRO BOOST', { worldH: 0.45, width: 420, height: 64, font: '700 32px "JetBrains Mono"', color: '#ffc23d' });
    bLbl.sprite.position.set(0, 1.2, 0);
    bGroup.add(padMesh, bLbl.sprite);
    root.add(bGroup);
    boostPads.push({ pos: new THREE.Vector3(bx, 0, bz), cooldown: 0 });
  }

  // ── Knockable Bruno-Simon-style Cyber Blocks ──
  const crates = [];
  const crateGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + 0.15;
    const r = 14 + (i % 3) * 4.2;
    const cGroup = new THREE.Group();
    const col = ['#22e4ff', '#3dffb5', '#ffc23d', '#ff4fa3'][i % 4];
    cGroup.add(new THREE.Mesh(crateGeo, bodyMat('#0d1630', 0.92)));
    cGroup.add(edgeLines(crateGeo, col, 1.6));
    cGroup.position.set(Math.cos(a) * r, 0.48, Math.sin(a) * r);
    root.add(cGroup);
    crates.push({ g: cGroup, vx: 0, vy: 0, vz: 0, col, hitCooldown: 0 });
  }

  // ── 8 Interactive Project Pit-Stop Billboards (inner ring) ──
  const billboards = [];
  projects.slice(0, 8).forEach((p, i) => {
    const a = (i / 8) * Math.PI * 2;
    const bx = Math.cos(a) * 13.5, bz = Math.sin(a) * 11.0;
    const b = new THREE.Group();
    b.position.set(bx, 1.6, bz);
    b.lookAt(0, 1.6, 0);
    const boardGeo = new THREE.BoxGeometry(3.6, 1.5, 0.14);
    b.add(new THREE.Mesh(boardGeo, bodyMat('#081126', 0.94)));
    b.add(edgeLines(boardGeo, p.color, 1.7));
    const t = textSprite(p.name, { worldH: 0.45, width: 540, height: 84, font: '700 40px "JetBrains Mono"', color: '#ffffff' });
    t.sprite.position.set(0, 0.22, 0.12);
    const tag = textSprite(p.tag, { worldH: 0.3, width: 540, height: 64, font: '600 28px "JetBrains Mono"', color: p.color });
    tag.sprite.position.set(0, -0.28, 0.12);
    b.add(t.sprite, tag.sprite);
    root.add(b);
    billboards.push({ p, pos: new THREE.Vector3(bx, 0, bz), g: b });
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

  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 0.06), glowMat('#ff2a5f', 2.6));
  tailBar.position.set(0, 0.44, -1.36);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.06), glowMat('#22e4ff', 2.6));
  headL.position.set(-0.42, 0.4, 1.36);
  const headR = headL.clone();
  headR.position.x = 0.42;
  const underglow = glowSprite('#22e4ff', 3.6, 0.6);
  underglow.position.y = 0.08;
  car.add(carBody, carCabin, carEdge, cabinEdge, tailBar, headL, headR, underglow);
  root.add(car);

  // ── Forza Horizon Telemetry HUD + Quick Teleport GPS + Touch Controls ──
  const hud = document.createElement('div');
  hud.className = 'drive-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none';
  hud.innerHTML = `
    <!-- Quick Teleport GPS Bar -->
    <div class="drive-gps">
      <span class="dg-lbl">🏎️ QUICK TELEPORT TO GATE:</span>
      <div class="dg-pills">
        ${missions.map((m, i) => `<button type="button" class="dg-pill" data-tp="${i}" style="--c:${m.color}" title="Teleport to ${m.title}">${pad(m.n)} ${m.title}</button>`).join('')}
      </div>
    </div>

    <!-- Mission Gate Prompt -->
    <div class="drive-prompt" id="drive-prompt">
      <div class="dp-meta"><b id="dp-num">01</b><span id="dp-title">HELLO, WORLD</span></div>
      <p class="dp-sub" id="dp-sub">Press [E] or [ENTER] to play mission · [R] to view story & certificates</p>
      <div class="dp-btns">
        <button type="button" class="btn primary small" id="dp-play">▶ PLAY MISSION [E]</button>
        <button type="button" class="btn small" id="dp-read">📖 STORY & CERTS [R]</button>
      </div>
    </div>

    <!-- Project Pit-Stop Prompt -->
    <div class="drive-proj-prompt" id="drive-proj-prompt">
      <div class="dp-meta"><b id="dpp-tag">PROJECT PIT-STOP</b><span id="dpp-name">AlgoVision</span></div>
      <p class="dp-sub" id="dpp-desc"></p>
      <div class="dp-btns">
        <a class="btn primary small" id="dpp-demo" href="#" target="_blank" rel="noopener">🚀 Live Demo [F] ↗</a>
        <a class="btn small" id="dpp-repo" href="#" target="_blank" rel="noopener">💻 GitHub Repo [G] ↗</a>
      </div>
    </div>

    <!-- Forza Speedometer Dial -->
    <div class="forza-dial">
      <div class="fd-top"><span class="fd-gear" id="fd-gear">N</span><div class="fd-spd"><b id="fd-kmh">000</b><em>KM/H</em></div></div>
      <div class="fd-rpm"><i id="fd-rpm-bar"></i></div>
      <div class="fd-sub"><span id="fd-drift">WASD / ARROWS · SPACE DRIFT · SHIFT NITRO</span></div>
      <div class="fd-actions">
        <button type="button" class="btn small" id="fd-horn">💥 SHOCKWAVE [H]</button>
        <button type="button" class="btn small" id="fd-reset-car">↺ RESET CAR</button>
      </div>
    </div>

    <!-- Mobile Touch Controls -->
    <div class="drive-touch">
      <div class="dt-left">
        <button type="button" data-k="KeyA">◀</button>
        <button type="button" data-k="KeyD">▶</button>
      </div>
      <div class="dt-right">
        <button type="button" data-k="ShiftLeft" class="boost">NITRO</button>
        <button type="button" data-k="Space" class="boost">DRIFT</button>
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
  let activeProj = null;
  let speed = 0;
  let heading = Math.PI / 2;
  let driftScore = 0;
  let nitroTimer = 0;
  let visible = false;
  let blocked = false;

  function teleportToGate(idx) {
    const gt = gates[idx];
    if (!gt) return;
    audio.sfx.warp();
    speed = 0;
    car.position.set(gt.pos.x, 0, gt.pos.z);
    heading = -gt.ang + Math.PI / 2;
    car.rotation.y = heading;
    fx.ring(gt.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), gt.m.color, 4.5, 0.7);
    fx.burst(gt.pos.clone().add(new THREE.Vector3(0, 1, 0)), gt.m.color, 35, 6, 0.2, 0.8);
    onToast?.(`⚡ Teleported to Gate ${pad(gt.m.n)}: ${gt.m.title}`);
  }

  function triggerShockwave() {
    audio.sfx.hit();
    const p = car.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    fx.ring(p, '#22e4ff', 8.5, 0.65);
    fx.burst(p, '#3dffb5', 40, 7, 0.2, 0.75);
    let blasted = 0;
    crates.forEach((c) => {
      const dx = c.g.position.x - car.position.x;
      const dz = c.g.position.z - car.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 9.5) {
        const f = (1 - d / 9.5) * 18 + 6;
        c.vx = (dx / Math.max(0.2, d)) * f;
        c.vz = (dz / Math.max(0.2, d)) * f;
        c.vy = 7.5;
        blasted++;
      }
    });
    if (blasted > 0) {
      driftScore += blasted * 25;
      store.state.xp += blasted * 10;
      store.save();
      fx.pop(p, `💥 SHOCKWAVE! +${blasted * 25} PTS`, '#22e4ff');
    }
  }

  hud.querySelectorAll('[data-tp]').forEach((btn) => {
    btn.addEventListener('click', () => teleportToGate(Number(btn.dataset.tp)));
  });
  hud.querySelector('#fd-horn').addEventListener('click', () => triggerShockwave());
  hud.querySelector('#fd-reset-car').addEventListener('click', () => {
    audio.sfx.click();
    car.position.set(0, 0, 22);
    heading = Math.PI / 2;
    speed = 0;
    fx.ring(car.position.clone(), '#22e4ff', 4, 0.5);
  });

  hud.querySelector('#dp-play').addEventListener('click', () => {
    if (activeGate) { audio.sfx.click(); playMission(activeGate.i); }
  });
  hud.querySelector('#dp-read').addEventListener('click', () => {
    if (activeGate) { audio.sfx.click(); inspectMission(activeGate.m); }
  });

  const kmhEl = hud.querySelector('#fd-kmh');
  const gearEl = hud.querySelector('#fd-gear');
  const rpmBar = hud.querySelector('#fd-rpm-bar');
  const driftEl = hud.querySelector('#fd-drift');
  const promptEl = hud.querySelector('#drive-prompt');
  const dpNum = hud.querySelector('#dp-num');
  const dpTitle = hud.querySelector('#dp-title');
  const projPromptEl = hud.querySelector('#drive-proj-prompt');
  const dppTag = hud.querySelector('#dpp-tag');
  const dppName = hud.querySelector('#dpp-name');
  const dppDesc = hud.querySelector('#dpp-desc');
  const dppDemo = hud.querySelector('#dpp-demo');
  const dppRepo = hud.querySelector('#dpp-repo');

  onFrame((dt, t) => {
    if (!visible || blocked) return;
    spireGroup.rotation.y += dt * 0.6;

    const kd = (c) => input.keysDown.has(c) || touchKeys.has(c);
    const gas = kd('KeyW') || kd('ArrowUp');
    const brk = kd('KeyS') || kd('ArrowDown');
    const left = kd('KeyA') || kd('ArrowLeft');
    const right = kd('KeyD') || kd('ArrowRight');
    const boost = kd('ShiftLeft') || kd('ShiftRight') || nitroTimer > 0;
    const handbrake = kd('Space');

    if (nitroTimer > 0) nitroTimer = Math.max(0, nitroTimer - dt);
    if (input.keysPressed.has('KeyH')) triggerShockwave();

    const maxSpd = boost ? 34 : 22;
    const accel = boost ? 28 : 17;
    if (gas || nitroTimer > 0) speed += accel * dt;
    else if (brk) speed -= 19 * dt;
    else speed *= Math.pow(0.24, dt);
    speed = THREE.MathUtils.clamp(speed, -12, maxSpd);

    const turnRate = (handbrake ? 3.3 : 2.3) * Math.min(1, Math.abs(speed) / 3.5);
    const dirSign = speed >= -0.1 ? 1 : -1;
    if (left) heading += turnRate * dt * dirSign;
    if (right) heading -= turnRate * dt * dirSign;

    car.rotation.y = heading;
    const targetRoll = (left ? 0.08 : right ? -0.08 : 0) * Math.min(1, Math.abs(speed) / 10);
    carBody.rotation.z += (targetRoll - carBody.rotation.z) * 0.2;

    const vx = Math.sin(heading) * speed;
    const vz = Math.cos(heading) * speed;
    car.position.x = THREE.MathUtils.clamp(car.position.x + vx * dt, -58, 58);
    car.position.z = THREE.MathUtils.clamp(car.position.z + vz * dt, -58, 58);

    // Exhaust & drift particles
    if (Math.abs(speed) > 2) {
      if ((handbrake || boost) && Math.random() < 0.65) {
        const rear = new THREE.Vector3(-Math.sin(heading) * 1.4, 0.2, -Math.cos(heading) * 1.4).add(car.position);
        fx.burst(rear, boost ? '#3dffb5' : '#ffc23d', 2, 1.6, 0.14, 0.35, 0);
      }
      if (handbrake && (left || right) && Math.abs(speed) > 8) {
        driftScore += Math.round(dt * 120);
      }
    }

    // Check Nitro Boost Pads
    for (const bp of boostPads) {
      if (bp.cooldown > 0) bp.cooldown -= dt;
      if (bp.cooldown <= 0 && car.position.distanceTo(bp.pos) < 2.6) {
        bp.cooldown = 3.0;
        nitroTimer = 1.6;
        speed = 34;
        audio.sfx.rev?.();
        fx.ring(bp.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), '#ffc23d', 5, 0.6);
        fx.pop(car.position.clone().add(new THREE.Vector3(0, 1.5, 0)), '⚡ NITRO BOOST! +50 XP', '#ffc23d');
        driftScore += 50;
      }
    }

    // Crate collisions & physics
    for (const c of crates) {
      if (c.hitCooldown > 0) c.hitCooldown -= dt;
      const dx = c.g.position.x - car.position.x;
      const dz = c.g.position.z - car.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.65 && c.hitCooldown <= 0) {
        c.hitCooldown = 0.5;
        const push = Math.max(8, Math.abs(speed) * 1.25);
        c.vx = (dx / Math.max(0.1, dist)) * push;
        c.vz = (dz / Math.max(0.1, dist)) * push;
        c.vy = 5.2;
        audio.sfx.hit();
        fx.burst(c.g.position, c.col, 14, 4, 0.14, 0.5);
        driftScore += 25;
      }
      if (Math.abs(c.vx) > 0.05 || Math.abs(c.vz) > 0.05 || c.g.position.y > 0.48) {
        c.g.position.x += c.vx * dt;
        c.g.position.z += c.vz * dt;
        c.g.position.y += c.vy * dt;
        c.vy -= 18 * dt;
        c.g.rotation.x += c.vz * dt * 0.5;
        c.g.rotation.z -= c.vx * dt * 0.5;
        if (c.g.position.y <= 0.48) {
          c.g.position.y = 0.48;
          c.vy = 0;
          c.vx *= 0.82;
          c.vz *= 0.82;
        }
      }
    }

    // Smooth Chase Camera
    const camTarget = new THREE.Vector3(
      car.position.x - Math.sin(heading) * 8.2,
      4.0 + Math.min(1.4, Math.abs(speed) * 0.045),
      car.position.z - Math.cos(heading) * 8.2,
    );
    camera.position.lerp(camTarget, 1 - Math.pow(0.0015, dt));
    camera.lookAt(car.position.x + Math.sin(heading) * 3.2, 0.9, car.position.z + Math.cos(heading) * 3.2);

    // Check proximity to Mission Gates
    let nearestGate = null;
    let bestGateD = 4.6;
    for (const gt of gates) {
      gt.padRing.rotation.z = t * 0.8;
      const d = car.position.distanceTo(gt.pos);
      if (d < bestGateD) { bestGateD = d; nearestGate = gt; }
    }
    if (nearestGate !== activeGate) {
      activeGate = nearestGate;
      if (activeGate) {
        audio.sfx.hover();
        dpNum.textContent = `GATE ${pad(activeGate.m.n)} · ${activeGate.m.year}`;
        dpTitle.textContent = activeGate.m.title.toUpperCase();
        promptEl.classList.add('open');
      } else {
        promptEl.classList.remove('open');
      }
    }

    if (activeGate) {
      if (input.keysPressed.has('KeyE') || input.keysPressed.has('Enter')) {
        audio.sfx.click();
        playMission(activeGate.i);
      } else if (input.keysPressed.has('KeyR')) {
        audio.sfx.click();
        inspectMission(activeGate.m);
      }
    }

    // Check proximity to Project Billboards
    let nearestProj = null;
    let bestProjD = 4.5;
    if (!activeGate) {
      for (const bb of billboards) {
        const d = car.position.distanceTo(bb.pos);
        if (d < bestProjD) { bestProjD = d; nearestProj = bb; }
      }
    }
    if (nearestProj !== activeProj) {
      activeProj = nearestProj;
      if (activeProj) {
        audio.sfx.hover();
        dppTag.textContent = activeProj.p.tag;
        dppName.textContent = activeProj.p.name;
        dppDesc.textContent = activeProj.p.blurb;
        if (activeProj.p.demo) {
          dppDemo.href = activeProj.p.demo;
          dppDemo.style.display = '';
        } else {
          dppDemo.style.display = 'none';
        }
        dppRepo.href = activeProj.p.url;
        projPromptEl.classList.add('open');
      } else {
        projPromptEl.classList.remove('open');
      }
    }
    if (activeProj) {
      if (input.keysPressed.has('KeyF') && activeProj.p.demo) {
        window.open(activeProj.p.demo, '_blank', 'noopener');
      } else if (input.keysPressed.has('KeyG') && activeProj.p.url) {
        window.open(activeProj.p.url, '_blank', 'noopener');
      }
    }

    // Update Forza Speedometer HUD
    const kmh = Math.round(Math.abs(speed) * 7.2);
    kmhEl.textContent = String(kmh).padStart(3, '0');
    const gear = kmh < 3 ? 'N' : Math.min(6, Math.floor(kmh / 35) + 1);
    gearEl.textContent = gear;
    const rpm = kmh < 3 ? 0.12 : ((kmh % 35) / 35) * 0.75 + 0.25;
    rpmBar.style.transform = `scaleX(${Math.min(1, rpm).toFixed(2)})`;
    if (driftScore > 0) {
      driftEl.textContent = `🔥 SKILL SCORE: +${driftScore} XP · [H] SHOCKWAVE`;
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
      projPromptEl.classList.remove('open');
      touchKeys.clear();
    },
    refresh() {
      gates.forEach((gt, i) => {
        const clr = store.isCleared(gt.m.id);
        gt.padRing.material.color.set(clr ? '#3dffb5' : gt.m.color);
        const pill = hud.querySelector(`[data-tp="${i}"]`);
        if (pill) pill.classList.toggle('cleared', clr);
      });
    },
    set blocked(v) { blocked = v; },
  };
}
