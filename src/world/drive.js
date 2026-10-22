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

export function createDriveWorld({ onPlayMission, onSelectMission, onInspectMission, onToast }) {
  const playMission = onPlayMission || onSelectMission || (() => {});
  const inspectMission = onInspectMission || (() => {});

  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ── Expansive Ground Grid & Wide Neon Oval Highway (rx=52, rz=38) ──
  const TRACK_RX = 52;
  const TRACK_RZ = 38;

  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: globalU.uTime },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP; uniform float uTime;
      void main(){
        vec2 p = vP * 0.18;
        vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float normR = length(vec2(vP.x / 52.0, vP.y / 38.0));
        float road = smoothstep(0.105, 0.0, abs(normR - 1.0));
        float centerDash = smoothstep(0.008, 0.0, abs(normR - 1.0)) * step(0.45, fract(atan(vP.y, vP.x) * 18.0 / 3.14159 - uTime * 0.4));
        float edge = smoothstep(0.014, 0.0, abs(abs(normR - 1.0) - 0.082));
        float fade = smoothstep(155.0, 25.0, length(vP));
        vec3 col = mix(vec3(0.06, 0.34, 0.72), vec3(0.10, 0.85, 0.68), road);
        col = mix(col, vec3(0.22, 0.95, 1.0), edge + centerDash * 0.7);
        float a = (line * 0.2 + road * 0.22 + edge * 0.48 + centerDash * 0.35) * fade;
        gl_FragColor = vec4(col * 1.45 * a, a);
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), gridMat);
  ground.rotation.x = -Math.PI / 2;
  root.add(ground);

  // ── 3D Architectural Center Monument & Rotating Orbital Rings ──
  const spireGroup = new THREE.Group();
  const spireGeo = new THREE.OctahedronGeometry(2.8, 0);
  spireGeo.scale(0.8, 2.5, 0.8);
  const spireMesh = new THREE.Mesh(spireGeo, bodyMat('#09132c', 0.92));
  const spireEdge = edgeLines(spireGeo, '#22e4ff', 1.8);
  const spireRingA = new THREE.Mesh(new THREE.TorusGeometry(4.8, 0.06, 10, 64), glowMat('#3dffb5', 1.5, 0.7));
  const spireRingB = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.04, 10, 64), glowMat('#b07cff', 1.4, 0.55));
  spireRingA.rotation.x = Math.PI / 3;
  spireRingB.rotation.y = Math.PI / 4;
  const spireHalo = glowSprite('#22e4ff', 11, 0.36);
  spireGroup.add(spireMesh, spireEdge, spireRingA, spireRingB, spireHalo);
  spireGroup.position.set(0, 5.2, 0);
  root.add(spireGroup);

  // ── 3D Cyber-City Skyline Monoliths Around the Outer Horizon (28 Towers) ──
  for (let i = 0; i < 28; i++) {
    const ang = (i / 28) * Math.PI * 2;
    const dist = 92 + (i % 3) * 10;
    const bx = Math.cos(ang) * dist;
    const bz = Math.sin(ang) * (dist * 0.82);
    const h = 7 + (i * 3.7) % 16;
    const w = 2.6 + (i % 3) * 0.9;
    const tGeo = new THREE.BoxGeometry(w, h, w);
    const tGroup = new THREE.Group();
    const col = ['#22e4ff', '#b07cff', '#3dffb5', '#ff4fa3'][i % 4];
    tGroup.add(new THREE.Mesh(tGeo, bodyMat('#060c1d', 0.95)));
    tGroup.add(edgeLines(tGeo, col, 1.1));
    tGroup.position.set(bx, h * 0.5, bz);
    root.add(tGroup);
  }

  // ── 20 Inner Trackside Neon Light Pylons ──
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2;
    const px = Math.cos(ang) * (TRACK_RX - 6.2);
    const pz = Math.sin(ang) * (TRACK_RZ - 5.2);
    const pGeo = new THREE.CylinderGeometry(0.06, 0.09, 2.6, 8);
    const pylon = new THREE.Mesh(pGeo, glowMat(i % 2 === 0 ? '#22e4ff' : '#3dffb5', 1.3, 0.75));
    pylon.position.set(px, 1.3, pz);
    root.add(pylon);
  }

  // ── 10 Mission Drive-Thru Gates Spaced Generously Along the Highway ──
  const gates = [];
  missions.forEach((m, i) => {
    const ang = (i / missions.length) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(ang) * TRACK_RX;
    const z = Math.sin(ang) * TRACK_RZ;
    const tx = -Math.sin(ang) * TRACK_RX;
    const tz = Math.cos(ang) * TRACK_RZ;
    const roadHeading = Math.atan2(tx, tz);

    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = roadHeading;

    // 3D Twin Support Pillars + Glowing Arch
    for (let s of [-3.1, 3.1]) {
      const pilGeo = new THREE.BoxGeometry(0.24, 3.2, 0.24);
      const pil = new THREE.Mesh(pilGeo, bodyMat('#0b1632', 0.95));
      pil.add(edgeLines(pilGeo, m.color, 1.5));
      pil.position.set(s, 1.6, 0);
      g.add(pil);
    }
    const archGeo = new THREE.TorusGeometry(3.1, 0.1, 12, 48, Math.PI);
    const arch = new THREE.Mesh(archGeo, glowMat(m.color, 1.7));
    arch.position.y = 1.6;
    const padRing = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 2.75, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(m.color).multiplyScalar(1.4), side: THREE.DoubleSide, transparent: true, opacity: 0.72, toneMapped: false }),
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = 0.04;

    const lbl = textSprite(`${pad(m.n)} · ${m.title.toUpperCase()}`, {
      worldH: 0.62, width: 640, height: 84, font: '700 36px "JetBrains Mono"', color: '#ffffff',
    });
    lbl.sprite.position.set(0, 5.3, 0);

    g.add(arch, padRing, lbl.sprite);
    root.add(g);
    gates.push({ m, i, ang, roadHeading, g, padRing, arch, lblSprite: lbl.sprite, pos: new THREE.Vector3(x, 0, z) });
  });

  // ── 4 Real 3D Launch Ramps (Jump Pads) & 4 Nitro Strips Along the Track ──
  const ramps = [];
  const boostPads = [];
  for (let i = 0; i < 4; i++) {
    // 3D Launch Ramp between gates
    const rAng = (i / 4) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
    const rx = Math.cos(rAng) * (TRACK_RX - 1.8);
    const rz = Math.sin(rAng) * (TRACK_RZ - 1.4);
    const rtx = -Math.sin(rAng) * TRACK_RX;
    const rtz = Math.cos(rAng) * TRACK_RZ;
    const rHead = Math.atan2(rtx, rtz);

    const rampGroup = new THREE.Group();
    rampGroup.position.set(rx, 0, rz);
    rampGroup.rotation.y = rHead;
    // Inclined 3D wedge ramp
    const rampGeo = new THREE.BoxGeometry(2.8, 0.35, 3.8);
    const rampMesh = new THREE.Mesh(rampGeo, bodyMat('#13224a', 0.94));
    rampMesh.add(edgeLines(rampGeo, '#3dffb5', 1.8));
    rampMesh.rotation.x = -0.22;
    rampMesh.position.y = 0.38;
    rampGroup.add(rampMesh);
    root.add(rampGroup);
    ramps.push({ pos: new THREE.Vector3(rx, 0, rz), cooldown: 0 });

    // Glowing Nitro Pad
    const bAng = (i / 4) * Math.PI * 2 - Math.PI / 2 + Math.PI / 10;
    const bx = Math.cos(bAng) * TRACK_RX;
    const bz = Math.sin(bAng) * TRACK_RZ;
    const btx = -Math.sin(bAng) * TRACK_RX;
    const btz = Math.cos(bAng) * TRACK_RZ;
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.04, bz);
    bGroup.rotation.y = Math.atan2(btx, btz);
    const padGeo = new THREE.PlaneGeometry(2.8, 4.4);
    const padMat = new THREE.MeshBasicMaterial({ color: 0xffc23d, side: THREE.DoubleSide, transparent: true, opacity: 0.48, toneMapped: false });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.rotation.x = -Math.PI / 2;
    bGroup.add(padMesh);
    root.add(bGroup);
    boostPads.push({ pos: new THREE.Vector3(bx, 0, bz), cooldown: 0 });
  }

  // ── 20 Collectible 3D Cyber-Shards Along the Racing Line ──
  const shards = [];
  const shardGeo = new THREE.OctahedronGeometry(0.42, 0);
  for (let i = 0; i < 20; i++) {
    const sAng = (i / 20) * Math.PI * 2 + 0.08;
    const rOffset = (i % 2 === 0 ? 1.8 : -1.8);
    const sx = Math.cos(sAng) * (TRACK_RX + rOffset);
    const sz = Math.sin(sAng) * (TRACK_RZ + rOffset * 0.75);
    const sMesh = new THREE.Mesh(shardGeo, glowMat(i % 2 === 0 ? '#22e4ff' : '#3dffb5', 1.6));
    sMesh.position.set(sx, 0.85, sz);
    root.add(sMesh);
    shards.push({ mesh: sMesh, basePos: new THREE.Vector3(sx, 0.85, sz), respawnAt: 0 });
  }

  // ── Knockable Cyber Physics Blocks in 4 Infield Drift Clusters (r=24) ──
  const crates = [];
  const crateGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
  for (let cluster = 0; cluster < 4; cluster++) {
    const baseAng = (cluster / 4) * Math.PI * 2 + Math.PI / 4;
    const cx = Math.cos(baseAng) * 24;
    const cz = Math.sin(baseAng) * 18;
    for (let k = 0; k < 4; k++) {
      const offsetAng = (k / 4) * Math.PI * 2;
      const cGroup = new THREE.Group();
      const col = ['#22e4ff', '#3dffb5', '#ffc23d', '#ff4fa3'][(cluster + k) % 4];
      cGroup.add(new THREE.Mesh(crateGeo, bodyMat('#0c152e', 0.92)));
      cGroup.add(edgeLines(crateGeo, col, 1.5));
      cGroup.position.set(cx + Math.cos(offsetAng) * 2.1, 0.48, cz + Math.sin(offsetAng) * 2.1);
      root.add(cGroup);
      crates.push({ g: cGroup, vx: 0, vy: 0, vz: 0, col, hitCooldown: 0 });
    }
  }

  // ── 8 Project Pit-Stop Billboards on Outer Shoulder (rx=69, rz=52) ──
  const billboards = [];
  projects.slice(0, 8).forEach((p, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
    const bx = Math.cos(a) * 69;
    const bz = Math.sin(a) * 52;
    const b = new THREE.Group();
    b.position.set(bx, 2.2, bz);
    b.lookAt(0, 2.2, 0);
    const boardGeo = new THREE.BoxGeometry(4.5, 1.7, 0.16);
    b.add(new THREE.Mesh(boardGeo, bodyMat('#071024', 0.94)));
    b.add(edgeLines(boardGeo, p.color, 1.6));
    const t = textSprite(p.name, { worldH: 0.46, width: 520, height: 76, font: '700 36px "JetBrains Mono"', color: '#ffffff' });
    t.sprite.position.set(0, 0.05, 0.14);
    b.add(t.sprite);

    const padX = Math.cos(a) * 63;
    const padZ = Math.sin(a) * 47.5;
    const pitRing = new THREE.Mesh(
      new THREE.RingGeometry(1.9, 2.25, 36),
      new THREE.MeshBasicMaterial({ color: p.color, side: THREE.DoubleSide, transparent: true, opacity: 0.5, toneMapped: false }),
    );
    pitRing.rotation.x = -Math.PI / 2;
    pitRing.position.set(padX, 0.04, padZ);
    root.add(b, pitRing);
    billboards.push({ p, pos: new THREE.Vector3(padX, 0, padZ), g: b, lblSprite: t.sprite });
  });

  // ── Detailed 3D Cyber-Supercar with 4 Rotating/Steering Wheels, GT Wing & Dual Afterburners ──
  const car = new THREE.Group();
  const startGate = gates[0];
  car.position.set(startGate.pos.x - 8, 0, startGate.pos.z);
  let heading = startGate.roadHeading;
  car.rotation.y = heading;

  const chassis = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(1.42, 0.38, 2.85);
  const cabinGeo = new THREE.BoxGeometry(1.12, 0.34, 1.38);
  const noseGeo = new THREE.BoxGeometry(1.32, 0.24, 0.65);

  const carBody = new THREE.Mesh(bodyGeo, bodyMat('#09132c', 0.96));
  carBody.position.y = 0.4;
  carBody.add(edgeLines(bodyGeo, '#22e4ff', 1.8));

  const carNose = new THREE.Mesh(noseGeo, bodyMat('#0c1a3b', 0.96));
  carNose.position.set(0, 0.32, 1.55);
  carNose.add(edgeLines(noseGeo, '#22e4ff', 1.5));

  const carCabin = new THREE.Mesh(cabinGeo, bodyMat('#10224a', 0.92));
  carCabin.position.set(0, 0.72, -0.12);
  carCabin.add(edgeLines(cabinGeo, '#3dffb5', 1.5));

  // Aerodynamic Rear GT Wing Spoiler
  const wingBladeGeo = new THREE.BoxGeometry(1.52, 0.05, 0.32);
  const wingBlade = new THREE.Mesh(wingBladeGeo, bodyMat('#0d1d42', 0.95));
  wingBlade.add(edgeLines(wingBladeGeo, '#ff4fa3', 1.5));
  wingBlade.position.set(0, 0.86, -1.32);
  const strutGeo = new THREE.BoxGeometry(0.06, 0.28, 0.16);
  const strutL = new THREE.Mesh(strutGeo, glowMat('#22e4ff', 1.3));
  strutL.position.set(-0.48, 0.7, -1.3);
  const strutR = strutL.clone();
  strutR.position.x = 0.48;

  // Tail Light Strip & Headlights
  const tailMat = glowMat('#ff2a5f', 2.4);
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.1, 0.06), tailMat);
  tailBar.position.set(0, 0.46, -1.44);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), glowMat('#22e4ff', 2.4));
  headL.position.set(-0.44, 0.36, 1.88);
  const headR = headL.clone();
  headR.position.x = 0.44;

  // Dual Exhaust Afterburner Flame Cones
  const flameGeo = new THREE.ConeGeometry(0.11, 0.65, 10);
  flameGeo.rotateX(-Math.PI / 2);
  const flameMat = glowMat('#3dffb5', 2.4, 0.0);
  const flameL = new THREE.Mesh(flameGeo, flameMat);
  flameL.position.set(-0.34, 0.28, -1.72);
  const flameR = new THREE.Mesh(flameGeo, flameMat);
  flameR.position.set(0.34, 0.28, -1.72);

  const underglow = glowSprite('#22e4ff', 3.8, 0.55);
  underglow.position.y = 0.08;

  chassis.add(carBody, carNose, carCabin, wingBlade, strutL, strutR, tailBar, headL, headR, flameL, flameR, underglow);
  car.add(chassis);

  // 4 Real 3D Rotating & Steering Wheels with Glowing Neon Rims
  const wheels = [];
  const wheelPivotsFront = [];
  const tireGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.24, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 18);
  rimGeo.rotateY(Math.PI / 2);

  const wheelCoords = [
    { x: -0.76, y: 0.31, z: 1.05, front: true },
    { x: 0.76, y: 0.31, z: 1.05, front: true },
    { x: -0.76, y: 0.31, z: -0.98, front: false },
    { x: 0.76, y: 0.31, z: -0.98, front: false },
  ];
  wheelCoords.forEach((wc) => {
    const pivot = new THREE.Group();
    pivot.position.set(wc.x, wc.y, wc.z);
    const wMesh = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, bodyMat('#050914', 0.98));
    const rim = new THREE.Mesh(rimGeo, glowMat('#22e4ff', 1.6));
    rim.position.x = wc.x < 0 ? -0.12 : 0.12;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.38, 0.05), glowMat('#3dffb5', 1.4));
    wMesh.add(tire, rim, spoke);
    pivot.add(wMesh);
    car.add(pivot);
    wheels.push(wMesh);
    if (wc.front) wheelPivotsFront.push(pivot);
  });

  root.add(car);

  // ── Forza Horizon Telemetry HUD + Minimap + Lap Race Challenge ──
  const hud = document.createElement('div');
  hud.className = 'drive-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none';
  hud.innerHTML = `
    <!-- Top Gate Teleport Strip + Lap Time-Trial Button -->
    <div class="drive-gps">
      <span class="dg-lbl">GATE</span>
      <div class="dg-pills">
        ${missions.map((m, i) => `<button type="button" class="dg-pill" data-tp="${i}" style="--c:${m.color}" title="Teleport to ${pad(m.n)} · ${m.title}">${pad(m.n)}</button>`).join('')}
      </div>
      <button type="button" class="dg-race-btn" id="dg-race-btn">⏱️ LAP TRIAL</button>
    </div>

    <!-- Live Skill Chain & Combo Banner (Top-Center below GPS when drifting/jumping) -->
    <div class="drive-combo" id="drive-combo">
      <b id="dc-mult">x1</b>
      <span id="dc-txt">SKILL CHAIN</span>
      <em id="dc-pts">+0 XP</em>
    </div>

    <!-- Clean Mission Gate Action Card -->
    <div class="drive-prompt" id="drive-prompt">
      <div class="dp-meta"><b id="dp-num">GATE 01</b><span id="dp-title">HELLO, WORLD</span></div>
      <div class="dp-btns">
        <button type="button" class="btn primary small" id="dp-play">▶ Play Mission [E]</button>
        <button type="button" class="btn small" id="dp-read">Story & Certs [R]</button>
      </div>
    </div>

    <!-- Clean Project Pit-Stop Action Card -->
    <div class="drive-proj-prompt" id="drive-proj-prompt">
      <div class="dp-meta"><b id="dpp-tag">PROJECT</b><span id="dpp-name">AlgoVision</span></div>
      <div class="dp-btns">
        <a class="btn primary small" id="dpp-demo" href="#" target="_blank" rel="noopener">Live Demo [F] ↗</a>
        <a class="btn small" id="dpp-repo" href="#" target="_blank" rel="noopener">GitHub [G] ↗</a>
      </div>
    </div>

    <!-- Live 2D Circuit Radar Minimap (Bottom Left) -->
    <div class="drive-minimap-wrap">
      <canvas id="drive-minimap" width="148" height="112"></canvas>
      <div class="dm-meta"><span id="dm-pos">HORIZON CIRCUIT</span><b id="dm-shards">0 SHARDS</b></div>
    </div>

    <!-- Forza Speedometer & RPM Arc Dial (Bottom Right) -->
    <div class="forza-dial">
      <div class="fd-top">
        <span class="fd-gear" id="fd-gear">N</span>
        <div class="fd-spd"><b id="fd-kmh">000</b><em>KM/H</em></div>
      </div>
      <div class="fd-rpm"><i id="fd-rpm-bar"></i></div>
      <div class="fd-sub"><span id="fd-drift">WASD DRIVE · SPACE DRIFT · SHIFT NITRO</span></div>
      <div class="fd-actions">
        <button type="button" class="btn small" id="fd-horn">Shockwave [H]</button>
        <button type="button" class="btn small" id="fd-reset-car">Reset</button>
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

  const minimapCanvas = hud.querySelector('#drive-minimap');
  const mctx = minimapCanvas.getContext('2d');
  const dmShardsEl = hud.querySelector('#dm-shards');
  const comboEl = hud.querySelector('#drive-combo');
  const dcMultEl = hud.querySelector('#dc-mult');
  const dcTxtEl = hud.querySelector('#dc-txt');
  const dcPtsEl = hud.querySelector('#dc-pts');
  const raceBtn = hud.querySelector('#dg-race-btn');

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
  let steerAngle = 0;
  let carY = 0;
  let carVy = 0;
  let driftScore = 0;
  let shardsCollected = 0;
  let comboMult = 1;
  let comboTimer = 0;
  let nitroTimer = 0;
  let visible = false;
  let blocked = false;

  // Lap Time-Trial State
  let raceActive = false;
  let raceGateIdx = 0;
  let raceTime = 0;
  let bestLap = 0;

  function addSkillAction(label, pts) {
    comboTimer = 3.2;
    comboMult = Math.min(5, comboMult + 1);
    const total = pts * comboMult;
    driftScore += total;
    store.state.xp += Math.round(total * 0.25);
    store.save();
    dcMultEl.textContent = `x${comboMult}`;
    dcTxtEl.textContent = label;
    dcPtsEl.textContent = `+${driftScore} XP`;
    comboEl.classList.add('open');
  }

  function teleportToGate(idx) {
    const gt = gates[idx];
    if (!gt) return;
    audio.sfx.warp();
    speed = 0;
    carY = 0;
    carVy = 0;
    heading = gt.roadHeading;
    car.position.set(gt.pos.x, 0, gt.pos.z);
    car.rotation.y = heading;
    camera.position.set(
      car.position.x - Math.sin(heading) * 9.0,
      4.5,
      car.position.z - Math.cos(heading) * 9.0,
    );
    camera.lookAt(car.position.x + Math.sin(heading) * 4, 1.1, car.position.z + Math.cos(heading) * 4);
    fx.ring(gt.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), gt.m.color, 4.5, 0.65);
    onToast?.(`Gate ${pad(gt.m.n)}: ${gt.m.title} — Press [E] to Play`);
  }

  raceBtn.addEventListener('click', () => {
    audio.sfx.win();
    teleportToGate(0);
    raceActive = true;
    raceGateIdx = 1;
    raceTime = 0;
    onToast?.('🏁 Lap Trial Started! Drive through Gates 02 → 10 → 01!');
  });

  function triggerShockwave() {
    audio.sfx.hit();
    const p = car.position.clone().add(new THREE.Vector3(0, 0.5, 0));
    fx.ring(p, '#22e4ff', 8.5, 0.6);
    fx.burst(p, '#3dffb5', 32, 6.5, 0.18, 0.7);
    let blasted = 0;
    crates.forEach((c) => {
      const dx = c.g.position.x - car.position.x;
      const dz = c.g.position.z - car.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 12.0) {
        const f = (1 - d / 12.0) * 18 + 6;
        c.vx = (dx / Math.max(0.2, d)) * f;
        c.vz = (dz / Math.max(0.2, d)) * f;
        c.vy = 7.2;
        blasted++;
      }
    });
    if (blasted > 0) {
      addSkillAction('SHOCKWAVE BLAST', blasted * 25);
      fx.pop(p, `+${blasted * 25} PTS`, '#22e4ff');
    }
  }

  hud.querySelectorAll('[data-tp]').forEach((btn) => {
    btn.addEventListener('click', () => teleportToGate(Number(btn.dataset.tp)));
  });
  hud.querySelector('#fd-horn').addEventListener('click', () => triggerShockwave());
  hud.querySelector('#fd-reset-car').addEventListener('click', () => {
    audio.sfx.click();
    car.position.set(startGate.pos.x - 8, 0, startGate.pos.z);
    carY = 0;
    carVy = 0;
    heading = startGate.roadHeading;
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
  const dppDemo = hud.querySelector('#dpp-demo');
  const dppRepo = hud.querySelector('#dpp-repo');

  function drawMinimap() {
    const W = minimapCanvas.width;
    const H = minimapCanvas.height;
    const cx = W * 0.5;
    const cy = H * 0.5;
    const scale = 0.78;
    mctx.clearRect(0, 0, W, H);

    // Oval highway track
    mctx.strokeStyle = 'rgba(34, 228, 255, 0.28)';
    mctx.lineWidth = 4;
    mctx.beginPath();
    mctx.ellipse(cx, cy, TRACK_RX * scale, TRACK_RZ * scale, 0, 0, Math.PI * 2);
    mctx.stroke();

    // 10 Mission Gates on Minimap
    gates.forEach((gt, idx) => {
      const gx = cx + gt.pos.x * scale;
      const gz = cy + gt.pos.z * scale;
      mctx.fillStyle = raceActive && idx === raceGateIdx ? '#ffc23d' : gt.m.color;
      mctx.beginPath();
      mctx.arc(gx, gz, raceActive && idx === raceGateIdx ? 3.8 : 2.3, 0, Math.PI * 2);
      mctx.fill();
    });

    // Player Car Arrow
    const px = cx + car.position.x * scale;
    const pz = cy + car.position.z * scale;
    mctx.save();
    mctx.translate(px, pz);
    mctx.rotate(-heading + Math.PI);
    mctx.fillStyle = '#3dffb5';
    mctx.beginPath();
    mctx.moveTo(0, -5);
    mctx.lineTo(3.6, 4);
    mctx.lineTo(-3.6, 4);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  onFrame((dt, t) => {
    if (!visible || blocked) return;
    spireGroup.rotation.y += dt * 0.5;
    spireRingA.rotation.z = t * 0.8;
    spireRingB.rotation.x = t * 0.6;

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboMult = 1;
        comboEl.classList.remove('open');
      }
    }

    const kd = (c) => input.keysDown.has(c) || touchKeys.has(c);
    const gas = kd('KeyW') || kd('ArrowUp');
    const brk = kd('KeyS') || kd('ArrowDown');
    const left = kd('KeyA') || kd('ArrowLeft');
    const right = kd('KeyD') || kd('ArrowRight');
    const boost = kd('ShiftLeft') || kd('ShiftRight') || nitroTimer > 0;
    const handbrake = kd('Space');

    if (nitroTimer > 0) nitroTimer = Math.max(0, nitroTimer - dt);
    if (input.keysPressed.has('KeyH')) triggerShockwave();

    const maxSpd = boost ? 38 : 25;
    const accel = boost ? 32 : 19;
    if (gas || nitroTimer > 0) speed += accel * dt;
    else if (brk) speed -= 22 * dt;
    else speed *= Math.pow(0.24, dt);
    speed = THREE.MathUtils.clamp(speed, -12, maxSpd);

    // Steering & 3D Front Wheel Turn
    const targetSteer = left ? 0.38 : right ? -0.38 : 0;
    steerAngle += (targetSteer - steerAngle) * 0.22;
    wheelPivotsFront.forEach((p) => { p.rotation.y = steerAngle; });
    wheels.forEach((w) => { w.rotation.x += speed * dt * 1.45; });

    // Exhaust Afterburner Flame & Brake Light Intensity
    const targetFlame = boost && speed > 4 ? 0.85 : 0.0;
    flameMat.opacity += (targetFlame - flameMat.opacity) * 0.25;
    flameL.scale.z = 0.8 + Math.sin(t * 40) * 0.25;
    flameR.scale.z = 0.8 + Math.cos(t * 40) * 0.25;
    tailMat.color.set(brk || handbrake ? '#ff5470' : '#b81d48');

    const turnRate = (handbrake ? 3.2 : 2.2) * Math.min(1, Math.abs(speed) / 3.5);
    const dirSign = speed >= -0.1 ? 1 : -1;
    if (left) heading += turnRate * dt * dirSign;
    if (right) heading -= turnRate * dt * dirSign;

    car.rotation.y = heading;
    const targetRoll = (left ? 0.08 : right ? -0.08 : 0) * Math.min(1, Math.abs(speed) / 10);
    chassis.rotation.z += (targetRoll - chassis.rotation.z) * 0.2;

    const vx = Math.sin(heading) * speed;
    const vz = Math.cos(heading) * speed;
    car.position.x = THREE.MathUtils.clamp(car.position.x + vx * dt, -90, 90);
    car.position.z = THREE.MathUtils.clamp(car.position.z + vz * dt, -80, 80);

    // 3D Jump Ramp Airtime Physics
    for (const r of ramps) {
      if (r.cooldown > 0) r.cooldown -= dt;
      if (r.cooldown <= 0 && carY <= 0.05 && Math.abs(speed) > 9 && car.position.distanceTo(r.pos) < 2.8) {
        r.cooldown = 2.0;
        carVy = Math.min(13.5, Math.abs(speed) * 0.42 + 4.5);
        audio.sfx.warp();
        addSkillAction('✈️ AIRTIME LAUNCH', 100);
        fx.pop(car.position.clone().add(new THREE.Vector3(0, 1.8, 0)), '✈️ AIRTIME +100 XP', '#3dffb5');
      }
    }
    if (carY > 0 || carVy > 0) {
      carY += carVy * dt;
      carVy -= 24 * dt;
      chassis.rotation.x = THREE.MathUtils.clamp(-carVy * 0.028, -0.28, 0.22);
      if (carY <= 0) {
        carY = 0;
        carVy = 0;
        chassis.rotation.x = 0;
        audio.sfx.hit();
        fx.ring(car.position.clone().add(new THREE.Vector3(0, 0.1, 0)), '#3dffb5', 4.5, 0.5);
      }
    } else {
      chassis.rotation.x *= 0.85;
    }
    car.position.y = carY;

    // Collectible 3D Cyber-Shards
    const now = performance.now();
    for (const s of shards) {
      if (!s.mesh.visible && now >= s.respawnAt) {
        s.mesh.visible = true;
        s.mesh.position.copy(s.basePos);
      }
      if (s.mesh.visible) {
        s.mesh.rotation.y = t * 2.2;
        s.mesh.position.y = 0.85 + Math.sin(t * 2.5 + s.basePos.x) * 0.15;
        const d = car.position.distanceTo(s.mesh.position);
        if (d < 4.2) {
          // Magnetic pull toward car
          s.mesh.position.lerp(car.position, 0.25);
        }
        if (d < 1.8) {
          s.mesh.visible = false;
          s.respawnAt = now + 8000;
          shardsCollected++;
          dmShardsEl.textContent = `${shardsCollected} SHARDS`;
          audio.sfx.coin();
          fx.burst(s.basePos, '#22e4ff', 14, 3.5, 0.14, 0.45);
          addSkillAction('💎 CYBER SHARD', 30);
        }
      }
    }

    // Drift & Boost Particles
    if (Math.abs(speed) > 2 && carY <= 0.1) {
      if ((handbrake || boost) && Math.random() < 0.65) {
        const rear = new THREE.Vector3(-Math.sin(heading) * 1.4, 0.2, -Math.cos(heading) * 1.4).add(car.position);
        fx.burst(rear, boost ? '#3dffb5' : '#ffc23d', 2, 1.5, 0.13, 0.32, 0);
      }
      if (handbrake && (left || right) && Math.abs(speed) > 8) {
        if (Math.random() < 0.15) addSkillAction('🔥 DRIFT SLIDE', 15);
      }
    }

    // Nitro Boost Pads
    for (const bp of boostPads) {
      if (bp.cooldown > 0) bp.cooldown -= dt;
      if (bp.cooldown <= 0 && car.position.distanceTo(bp.pos) < 3.0) {
        bp.cooldown = 3.0;
        nitroTimer = 1.8;
        speed = 38;
        audio.sfx.rev?.();
        fx.ring(bp.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), '#ffc23d', 5, 0.55);
        addSkillAction('⚡ NITRO OVERDRIVE', 50);
      }
    }

    // Crate Collisions
    for (const c of crates) {
      if (c.hitCooldown > 0) c.hitCooldown -= dt;
      const dx = c.g.position.x - car.position.x;
      const dz = c.g.position.z - car.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.75 && c.hitCooldown <= 0) {
        c.hitCooldown = 0.5;
        const push = Math.max(8, Math.abs(speed) * 1.25);
        c.vx = (dx / Math.max(0.1, dist)) * push;
        c.vz = (dz / Math.max(0.1, dist)) * push;
        c.vy = 5.2;
        audio.sfx.hit();
        fx.burst(c.g.position, c.col, 12, 3.8, 0.13, 0.45);
        addSkillAction('💥 SMASH BONUS', 25);
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

    // Lap Time-Trial Logic
    if (raceActive) {
      raceTime += dt;
      const targetGate = gates[raceGateIdx];
      raceBtn.textContent = `⏱️ ${raceTime.toFixed(1)}s · NEXT: GATE ${pad(targetGate.m.n)}`;
      if (car.position.distanceTo(targetGate.pos) < 4.5) {
        audio.sfx.coin();
        fx.ring(targetGate.pos.clone().add(new THREE.Vector3(0, 1, 0)), '#ffc23d', 5, 0.55);
        if (raceGateIdx === 0) {
          // Completed full 10-gate lap!
          raceActive = false;
          bestLap = bestLap === 0 ? raceTime : Math.min(bestLap, raceTime);
          audio.sfx.win();
          addSkillAction('🏆 LAP COMPLETED', 250);
          raceBtn.textContent = `🏆 LAP: ${raceTime.toFixed(1)}s (BEST ${bestLap.toFixed(1)}s)`;
          onToast?.(`🏆 Horizon Circuit Lap Completed in ${raceTime.toFixed(2)}s!`);
        } else {
          raceGateIdx = (raceGateIdx + 1) % gates.length;
        }
      }
    }

    // Elevated Chase Camera
    const camTarget = new THREE.Vector3(
      car.position.x - Math.sin(heading) * 9.2,
      4.5 + carY * 0.5 + Math.min(1.5, Math.abs(speed) * 0.045),
      car.position.z - Math.cos(heading) * 9.2,
    );
    camera.position.lerp(camTarget, 1 - Math.pow(0.0012, dt));
    camera.lookAt(car.position.x + Math.sin(heading) * 4.0, 1.1 + carY * 0.6, car.position.z + Math.cos(heading) * 4.0);

    // Check proximity to Mission Gates + Distance-based label fade
    let nearestGate = null;
    let bestGateD = 5.0;
    for (const gt of gates) {
      gt.padRing.rotation.z = t * 0.8;
      const d = car.position.distanceTo(gt.pos);
      gt.lblSprite.material.opacity = THREE.MathUtils.clamp(1.42 - d / 38.0, 0.0, 0.95);
      if (d < bestGateD) { bestGateD = d; nearestGate = gt; }
    }
    if (nearestGate !== activeGate) {
      activeGate = nearestGate;
      if (activeGate) {
        audio.sfx.hover();
        dpNum.textContent = `GATE ${pad(activeGate.m.n)}`;
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

    // Check proximity to Outer-Shoulder Project Pit-Stops + Distance fade
    let nearestProj = null;
    let bestProjD = 5.0;
    for (const bb of billboards) {
      const d = car.position.distanceTo(bb.pos);
      bb.lblSprite.material.opacity = THREE.MathUtils.clamp(1.38 - d / 40.0, 0.0, 0.9);
      if (!activeGate && d < bestProjD) { bestProjD = d; nearestProj = bb; }
    }
    if (nearestProj !== activeProj) {
      activeProj = nearestProj;
      if (activeProj) {
        audio.sfx.hover();
        dppTag.textContent = activeProj.p.tag;
        dppName.textContent = activeProj.p.name;
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

    // Update Forza Speedometer & Minimap
    const kmh = Math.round(Math.abs(speed) * 7.2);
    kmhEl.textContent = String(kmh).padStart(3, '0');
    const gear = kmh < 3 ? 'N' : Math.min(6, Math.floor(kmh / 35) + 1);
    gearEl.textContent = gear;
    const rpm = kmh < 3 ? 0.12 : ((kmh % 35) / 35) * 0.75 + 0.25;
    rpmBar.style.transform = `scaleX(${Math.min(1, rpm).toFixed(2)})`;
    if (driftScore > 0) {
      driftEl.textContent = `SKILL SCORE +${driftScore} XP`;
    }
    drawMinimap();
  });

  return {
    show() {
      visible = true;
      root.visible = true;
      hud.style.display = 'block';
      hud.classList.add('open');
      setNebula('#0b1a38', '#063d50', 0.5);
      camera.fov = 54;
      camera.updateProjectionMatrix();
      document.body.style.cursor = 'default';
    },
    hide() {
      visible = false;
      root.visible = false;
      hud.style.display = 'none';
      hud.classList.remove('open');
      promptEl.classList.remove('open');
      projPromptEl.classList.remove('open');
      comboEl.classList.remove('open');
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
