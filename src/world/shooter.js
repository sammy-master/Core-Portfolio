import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, onFrame } from '../engine/renderer.js';
import { input } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';
import { missions } from '../data/content.js';
import { store } from '../engine/store.js';
import { setNebula } from './background.js';

const pad = (n) => String(n).padStart(2, '0');
const STREAK_NAMES = ['FIRST BLOOD', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', 'ACE // RADIANT'];

// 3 Completely Distinct Weapons: Full-Auto Assault Rifle, Piercing Rail Sniper, 8-Pellet Scatter Shotgun
const WEAPONS = [
  {
    id: 'vandal',
    name: 'VANDAL // AUTO RIFLE',
    modeDesc: 'FULL-AUTO · HOLD LMB TO SPRAY (9.5 RPS)',
    dmgHead: 160,
    dmgBody: 45,
    fireRate: 0.105,
    auto: true,
    pellets: 1,
    spread: 0.012,
    pierce: false,
    color: '#22e4ff',
    recoilAmt: 0.09,
    magSize: 30,
  },
  {
    id: 'operator',
    name: 'OPERATOR // RAIL SNIPER',
    modeDesc: 'PIERCING RAILBEAM · RIGHT-CLICK [RMB] TO ZOOM',
    dmgHead: 500,
    dmgBody: 255,
    fireRate: 0.72,
    auto: false,
    pellets: 1,
    spread: 0.0,
    pierce: true,
    color: '#ff4fa3',
    recoilAmt: 0.34,
    magSize: 5,
  },
  {
    id: 'judge',
    name: 'JUDGE // BUCKSHOT CANNON',
    modeDesc: '8-PELLET INCENDIARY SPREAD · MULTI-TARGET BLAST',
    dmgHead: 65,
    dmgBody: 34,
    fireRate: 0.38,
    auto: false,
    pellets: 8,
    spread: 0.068,
    pierce: false,
    color: '#ffc23d',
    recoilAmt: 0.24,
    magSize: 12,
  },
];

export function createShooterWorld({ onPlayMission, onInspectMission }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const raycaster = new THREE.Raycaster();
  const aimNdc = new THREE.Vector2();

  // ── Architectural 3D Firing Range Arena ──
  const floorGeo = new THREE.PlaneGeometry(90, 56);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x040712, transparent: true, opacity: 0.94 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.6;
  root.add(floor);

  // Glowing Range Lanes & Distance Markers
  for (let i = -5; i <= 5; i++) {
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 42),
      glowMat(i % 2 === 0 ? '#22e4ff' : '#b07cff', 0.9, 0.22),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(i * 4.6, -3.58, -8);
    root.add(lane);
  }

  // 3D Architectural Range Pillars on Left & Right Walls
  for (let side of [-1, 1]) {
    for (let z = -12; z <= 4; z += 4) {
      const pilGeo = new THREE.BoxGeometry(0.45, 9.5, 0.45);
      const pil = new THREE.Mesh(pilGeo, bodyMat('#081024', 0.92));
      pil.add(edgeLines(pilGeo, side < 0 ? '#22e4ff' : '#b07cff', 1.2));
      pil.position.set(side * 14.5, 1.1, z);
      root.add(pil);
    }
  }

  // ── 10 Holographic Mission Target Bots (Widely Spaced, Single Clean Title Badge) ──
  const bots = [];
  const hitObjects = [];
  const torsoGeo = new THREE.BoxGeometry(1.1, 1.3, 0.34);
  const headGeo = new THREE.OctahedronGeometry(0.36, 1);

  missions.forEach((m, i) => {
    const row = i < 5 ? 0 : 1;
    const col = i % 5;
    const x = (col - 2) * 4.6;
    const y = row === 0 ? 2.1 : -1.05;
    const z = row === 0 ? -4.8 : -3.2;

    const g = new THREE.Group();
    g.position.set(x, y, z);

    const torsoMat = bodyMat('#0b132b', 0.94);
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    const torsoEdge = edgeLines(torsoGeo, m.color, 1.5);

    const headMat = glowMat(m.color, 1.4, 0.9);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.02;
    const headRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.47, 32), glowMat('#ff5470', 1.4, 0.8));
    headRing.position.set(0, 1.02, 0.05);

    // Health Bar Strip on Chest
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.09), new THREE.MeshBasicMaterial({ color: 0x050814 }));
    hpBg.position.set(0, 0.42, 0.19);
    const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.06), glowMat('#3dffb5', 1.3));
    hpFill.position.set(0, 0.42, 0.2);

    const numTxt = textSprite(`${pad(m.n)} · ${m.title.toUpperCase()}`, {
      worldH: 0.31, width: 480, height: 64, font: '700 30px "JetBrains Mono"', color: '#ffffff',
    });
    numTxt.sprite.position.set(0, 1.68, 0.1);

    const bodyHit = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.65, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
    const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.64, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    headHit.position.y = 1.02;

    g.add(torso, torsoEdge, head, headRing, hpBg, hpFill, numTxt.sprite, bodyHit, headHit);
    root.add(g);

    const bot = { m, i, g, torsoMat, torsoEdge, head, headRing, hpFill, basePos: g.position.clone(), hp: 100, respawnAt: 0 };
    bodyHit.userData = { bot, headshot: false };
    headHit.userData = { bot, headshot: true };
    bots.push(bot);
    hitObjects.push(bodyHit, headHit);
  });

  // Bonus Moving Flick Drone Targets (2 aerial drones)
  const drones = [];
  for (let d = 0; d < 2; d++) {
    const dGroup = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 1), glowMat(d === 0 ? '#3dffb5' : '#ffc23d', 1.6));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.03, 8, 32), glowMat('#22e4ff', 1.3));
    const hitM = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    hitM.userData = { flick: true, droneIdx: d };
    dGroup.add(core, ring, hitM);
    dGroup.position.set(d === 0 ? -6.5 : 6.5, 4.1, -4.4);
    root.add(dGroup);
    hitObjects.push(hitM);
    drones.push({ g: dGroup, core, ring, baseX: d === 0 ? -6.0 : 6.0, phase: d * Math.PI });
  }

  // ── 3 Completely Distinct 3D First-Person Weapon Viewmodels ──
  const gun = new THREE.Group();
  gun.scale.setScalar(0.58);
  root.add(gun);

  // Model 0: VANDAL (Assault Rifle with Holo-Sight, Angled Grip & Cyan Energy Core)
  const modelVandal = new THREE.Group();
  {
    const recGeo = new THREE.BoxGeometry(0.16, 0.2, 1.25);
    const rec = new THREE.Mesh(recGeo, bodyMat('#0a142c', 0.96));
    rec.add(edgeLines(recGeo, '#22e4ff', 1.4));
    const bblGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.65, 10);
    const bbl = new THREE.Mesh(bblGeo, glowMat('#22e4ff', 1.3));
    bbl.rotation.x = Math.PI / 2;
    bbl.position.set(0, 0.03, -0.82);
    // Holo Sight Ring
    const holoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.18), bodyMat('#102042', 0.9));
    holoFrame.position.set(0, 0.17, 0.08);
    holoFrame.add(edgeLines(holoFrame.geometry, '#3dffb5', 1.4));
    const holoDot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), glowMat('#3dffb5', 2.0));
    holoDot.position.set(0, 0.17, 0.08);
    // Curved Magazine
    const magGeo = new THREE.BoxGeometry(0.09, 0.34, 0.16);
    const mag = new THREE.Mesh(magGeo, bodyMat('#0d1b3a', 0.95));
    mag.add(edgeLines(magGeo, '#22e4ff', 1.2));
    mag.position.set(0, -0.22, -0.15);
    mag.rotation.x = 0.22;
    modelVandal.add(rec, bbl, holoFrame, holoDot, mag);
  }

  // Model 1: OPERATOR (Heavy Twin-Rail Sniper Cannon with Floating Mag-Rings & Long Scope)
  const modelOperator = new THREE.Group();
  const opRings = [];
  {
    const bodyGeo = new THREE.BoxGeometry(0.2, 0.22, 1.15);
    const body = new THREE.Mesh(bodyGeo, bodyMat('#180a29', 0.96));
    body.add(edgeLines(bodyGeo, '#ff4fa3', 1.5));
    // Twin Rail Barrels
    for (let s of [-0.055, 0.055]) {
      const railGeo = new THREE.BoxGeometry(0.03, 0.04, 1.35);
      const rMesh = new THREE.Mesh(railGeo, glowMat('#ff4fa3', 1.5));
      rMesh.position.set(s, 0.02, -0.95);
      modelOperator.add(rMesh);
    }
    // 3 Floating Electromagnetic Accelerator Rings along the barrel
    for (let k = 0; k < 3; k++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 8, 24), glowMat('#22e4ff', 1.8));
      r.position.set(0, 0.02, -0.7 - k * 0.32);
      modelOperator.add(r);
      opRings.push(r);
    }
    // Long Sniper Telescopic Scope
    const scopeGeo = new THREE.CylinderGeometry(0.065, 0.05, 0.72, 16);
    const scope = new THREE.Mesh(scopeGeo, bodyMat('#230d38', 0.95));
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.21, -0.05);
    scope.add(edgeLines(scopeGeo, '#ff4fa3', 1.3));
    modelOperator.add(body, scope);
  }

  // Model 2: JUDGE (Heavy Double-Barrel Drum Shotgun with Glowing Amber Heat-Shield)
  const modelJudge = new THREE.Group();
  {
    const bodyGeo = new THREE.BoxGeometry(0.24, 0.22, 0.95);
    const body = new THREE.Mesh(bodyGeo, bodyMat('#241808', 0.96));
    body.add(edgeLines(bodyGeo, '#ffc23d', 1.5));
    // Twin Wide Shotgun Barrels
    for (let s of [-0.055, 0.055]) {
      const bblGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.85, 12);
      const bbl = new THREE.Mesh(bblGeo, bodyMat('#1a1206', 0.95));
      bbl.rotation.x = Math.PI / 2;
      bbl.position.set(s, 0.04, -0.65);
      bbl.add(edgeLines(bblGeo, '#ffc23d', 1.3));
      modelJudge.add(bbl);
    }
    // Rotary Drum Magazine
    const drumGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 16);
    const drum = new THREE.Mesh(drumGeo, bodyMat('#2e1e0a', 0.95));
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.14, -0.18);
    drum.add(edgeLines(drumGeo, '#ffc23d', 1.4));
    modelJudge.add(body, drum);
  }

  const muzzle = glowSprite('#22e4ff', 1.25, 0);
  muzzle.position.set(0, 0.04, -1.25);
  gun.add(modelVandal, modelOperator, modelJudge, muzzle);

  // ── Minimalist Tactical Shooter HUD ──
  const hud = document.createElement('div');
  hud.className = 'shooter-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none';
  hud.innerHTML = `
    <!-- Sniper Scope Overlay (Active on Right-Click with Operator) -->
    <div class="scope-overlay" id="scope-overlay">
      <div class="scope-ring">
        <div class="scope-h"></div>
        <div class="scope-v"></div>
        <span class="scope-zoom">2.2x RAIL OPTIC</span>
      </div>
    </div>

    <!-- Direct 1:1 Mouse-Following Crosshair (Changes Shape Per Weapon) -->
    <div class="xhair" id="xhair" data-w="vandal">
      <i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><span class="dot"></span>
      <span class="sg-ring"></span>
      <div class="hitmark" id="hitmark">✕</div>
    </div>

    <!-- Minimalist Top Telemetry & 30s Aim Trial Button -->
    <div class="sh-stats">
      <div><span>HITS</span><b id="sh-hits">0</b></div>
      <div><span>HEADSHOTS</span><b id="sh-hs">0</b></div>
      <div><span>ACCURACY</span><b id="sh-acc">100%</b></div>
      <div><span>STREAK</span><b id="sh-str">0</b></div>
      <button type="button" class="sh-trial-btn" id="sh-trial-btn">⚡ 30s AIM TRIAL</button>
    </div>

    <!-- Killfeed -->
    <div class="killfeed" id="killfeed"></div>

    <!-- Clean Target Action Card -->
    <div class="sh-target" id="sh-target">
      <div class="sht-head"><b id="sht-num">01</b><span id="sht-title">HELLO, WORLD</span><em id="sht-tag">LOCKED</em></div>
      <div class="sht-btns">
        <button type="button" class="btn primary small" id="sht-play">▶ Play Mission [E]</button>
        <button type="button" class="btn small" id="sht-read">Story & Certs [F]</button>
      </div>
    </div>

    <!-- Weapon Loadout & Ammo Bar (Bottom Right) -->
    <div class="sh-loadout" id="sh-loadout">
      <div class="sh-ammo-box">
        <div class="sha-top"><b id="sh-ammo">30</b><span>/ <em id="sh-mag">30</em></span><i id="sh-reload-hint">[R] RELOAD</i></div>
        <div class="sha-mode" id="sh-mode-desc">FULL-AUTO · HOLD LMB TO SPRAY</div>
      </div>
      <div class="sh-wbtns">
        <button type="button" class="sh-wbtn active" data-w="0"><b>1</b> VANDAL <em>AUTO</em></button>
        <button type="button" class="sh-wbtn" data-w="1"><b>2</b> OPERATOR <em>RAIL</em></button>
        <button type="button" class="sh-wbtn" data-w="2"><b>3</b> JUDGE <em>BUCKSHOT</em></button>
      </div>
    </div>`;
  document.getElementById('ui').appendChild(hud);

  const xhair = hud.querySelector('#xhair');
  const scopeOverlay = hud.querySelector('#scope-overlay');
  const hitmark = hud.querySelector('#hitmark');
  const killfeed = hud.querySelector('#killfeed');
  const targetBox = hud.querySelector('#sh-target');
  const hitsEl = hud.querySelector('#sh-hits');
  const hsEl = hud.querySelector('#sh-hs');
  const accEl = hud.querySelector('#sh-acc');
  const strEl = hud.querySelector('#sh-str');
  const ammoEl = hud.querySelector('#sh-ammo');
  const magEl = hud.querySelector('#sh-mag');
  const modeDescEl = hud.querySelector('#sh-mode-desc');
  const trialBtn = hud.querySelector('#sh-trial-btn');

  let selectedBot = null;
  let shots = 0, hits = 0, headshots = 0, streak = 0;
  let visible = false, blocked = false;
  let recoil = 0;
  let weaponIdx = 0;
  let ammo = WEAPONS[0].magSize;
  let fireCooldown = 0;
  let reloading = false;
  let scoped = false;
  let mouseX = window.innerWidth * 0.5;
  let mouseY = window.innerHeight * 0.5;

  // 30s Aim Trial State
  let trialActive = false;
  let trialTime = 0;
  let trialScore = 0;
  let bestTrialScore = 0;

  function syncWeaponUI() {
    const w = WEAPONS[weaponIdx];
    modelVandal.visible = weaponIdx === 0;
    modelOperator.visible = weaponIdx === 1;
    modelJudge.visible = weaponIdx === 2;
    muzzle.material.color.set(w.color);
    xhair.dataset.w = w.id;
    ammoEl.textContent = ammo;
    magEl.textContent = w.magSize;
    modeDescEl.textContent = w.modeDesc;
    modeDescEl.style.color = w.color;
    hud.querySelectorAll('.sh-wbtn').forEach((b, i) => b.classList.toggle('active', i === weaponIdx));
  }

  function setWeapon(idx) {
    if (weaponIdx === idx && !reloading) return;
    weaponIdx = idx;
    scoped = false;
    scopeOverlay.classList.remove('open');
    reloading = false;
    ammo = WEAPONS[weaponIdx].magSize;
    fireCooldown = 0.15;
    syncWeaponUI();
    audio.sfx.click();
    // Weapon equip flip animation
    gsap.fromTo(gun.rotation, { x: -0.55 }, { x: 0, duration: 0.28, ease: 'back.out(2)' });
  }
  syncWeaponUI();

  function reloadWeapon() {
    const w = WEAPONS[weaponIdx];
    if (reloading || ammo === w.magSize) return;
    reloading = true;
    scoped = false;
    scopeOverlay.classList.remove('open');
    audio.sfx.click();
    modeDescEl.textContent = 'RELOADING…';
    gsap.to(gun.rotation, { z: Math.PI * 2, duration: 0.55, ease: 'power2.inOut', onComplete: () => {
      gun.rotation.z = 0;
      ammo = w.magSize;
      reloading = false;
      syncWeaponUI();
    } });
  }

  hud.querySelectorAll('.sh-wbtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setWeapon(Number(btn.dataset.w));
    });
  });

  // Right-click toggles Sniper Scope on Operator (or zooms sight on others)
  window.addEventListener('contextmenu', (e) => {
    if (!visible || blocked) return;
    e.preventDefault();
    if (weaponIdx === 1) {
      scoped = !scoped;
      scopeOverlay.classList.toggle('open', scoped);
      audio.sfx.click();
    } else {
      scoped = !scoped;
      audio.sfx.click();
    }
  });

  // 30s Aim Trial Button
  trialBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.sfx.win();
    trialActive = true;
    trialTime = 30.0;
    trialScore = 0;
    bots.forEach((b) => { b.hp = 100; b.g.visible = true; b.hpFill.scale.x = 1; });
  });

  // 1:1 Direct Mouse Tracking: Moving mouse RIGHT moves crosshair RIGHT
  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!visible || blocked) return;
    xhair.style.left = `${mouseX}px`;
    xhair.style.top = `${mouseY}px`;
    if (scoped) {
      scopeOverlay.style.setProperty('--sx', `${mouseX}px`);
      scopeOverlay.style.setProperty('--sy', `${mouseY}px`);
    }
  });

  function selectBot(bot, hs) {
    selectedBot = bot;
    hud.querySelector('#sht-num').textContent = `CH ${pad(bot.m.n)}`;
    hud.querySelector('#sht-title').textContent = bot.m.title.toUpperCase();
    hud.querySelector('#sht-tag').textContent = hs ? '⌖ HEADSHOT' : 'ACQUIRED';
    targetBox.classList.add('open');
  }

  function addKill(bot, hs) {
    const item = document.createElement('div');
    item.className = 'kf-item' + (hs ? ' hs' : '');
    item.innerHTML = `<span class="me">${WEAPONS[weaponIdx].id.toUpperCase()}</span><i>${hs ? '⌖' : '▸'}</i><span class="victim">${pad(bot.m.n)} · ${bot.m.title}</span>`;
    killfeed.prepend(item);
    while (killfeed.children.length > 3) killfeed.lastElementChild.remove();
    gsap.fromTo(item, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.22 });
    gsap.to(item, { opacity: 0, duration: 0.35, delay: 3.2, onComplete: () => item.remove() });
  }

  hud.querySelector('#sht-play').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedBot) {
      audio.sfx.click();
      onPlayMission(selectedBot.i);
    }
  });
  hud.querySelector('#sht-read').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedBot) {
      audio.sfx.click();
      onInspectMission(selectedBot.m);
    }
  });

  function fireTracer(toWorld, color = '#22e4ff', thick = false) {
    const start = gun.position.clone().add(new THREE.Vector3(0, 0.03, -0.55));
    if (thick) {
      // Operator Railgun: Thick glowing beam + shockwave rings along the beam!
      const dir = toWorld.clone().sub(start);
      const len = dir.length();
      const beamGeo = new THREE.CylinderGeometry(0.045, 0.045, len, 8);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = glowMat(color, 2.4, 0.95);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.copy(start).addScaledVector(dir, 0.5);
      beam.lookAt(toWorld);
      root.add(beam);
      for (let r = 0.2; r <= 0.85; r += 0.3) {
        const ringPt = start.clone().addScaledVector(dir, r);
        fx.ring(ringPt, color, 1.4, 0.45);
      }
      gsap.to(beamMat, { opacity: 0, duration: 0.38, onComplete: () => { root.remove(beam); beamGeo.dispose(); beamMat.dispose(); } });
    } else {
      const pts = [start, toWorld.clone()];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.8), transparent: true, opacity: 0.88, toneMapped: false });
      const line = new THREE.Line(geo, mat);
      root.add(line);
      gsap.to(mat, { opacity: 0, duration: 0.16, onComplete: () => { root.remove(line); geo.dispose(); mat.dispose(); } });
    }
  }

  function shoot() {
    if (reloading || fireCooldown > 0) return;
    const w = WEAPONS[weaponIdx];
    if (ammo <= 0) {
      reloadWeapon();
      return;
    }

    ammo--;
    ammoEl.textContent = ammo;
    fireCooldown = w.fireRate;
    shots++;
    recoil = Math.min(0.45, recoil + w.recoilAmt);
    xhair.classList.add('recoil');
    setTimeout(() => xhair.classList.remove('recoil'), 85);
    muzzle.material.opacity = 0.95;
    gsap.to(muzzle.material, { opacity: 0, duration: 0.09 });

    // Distinct weapon audio feel
    audio.sfx.shot();
    if (weaponIdx === 1) audio.sfx.laser?.();
    if (weaponIdx === 2) audio.sfx.hit?.();

    const baseNdcX = (mouseX / window.innerWidth) * 2 - 1;
    const baseNdcY = -(mouseY / window.innerHeight) * 2 + 1;

    let anyHit = false;
    const damagedBotsThisShot = new Set();

    // Fire 1 ray for Vandal/Operator, or 8 spread pellets for Judge Buckshot!
    for (let p = 0; p < w.pellets; p++) {
      const spX = p === 0 && w.pellets === 1 ? (recoil > 0.16 ? rand(-w.spread, w.spread) : 0) : rand(-w.spread, w.spread);
      const spY = p === 0 && w.pellets === 1 ? (recoil > 0.16 ? rand(-w.spread, w.spread) : 0) : rand(-w.spread, w.spread);
      aimNdc.set(baseNdcX + spX, baseNdcY + spY);
      raycaster.setFromCamera(aimNdc, camera);

      const hitsList = raycaster.intersectObjects(hitObjects, false);
      const targetsToProcess = w.pierce ? hitsList : (hitsList[0] ? [hitsList[0]] : []);

      const fallbackPt = new THREE.Vector3();
      raycaster.ray.at(16, fallbackPt);
      const aimPt = hitsList[0] ? hitsList[0].point : fallbackPt;
      fireTracer(aimPt, hitsList[0]?.object.userData.headshot ? '#ff5470' : w.color, w.pierce);

      for (const hit of targetsToProcess) {
        anyHit = true;
        if (hit.object.userData.flick) {
          const dObj = drones[hit.object.userData.droneIdx];
          audio.sfx.headshot();
          fx.burst(dObj.g.position.clone(), '#3dffb5', 28, 5.5, 0.18, 0.6);
          fx.pop(dObj.g.position.clone(), '+50 XP DRONE SNIPE', '#3dffb5');
          store.state.xp += 50;
          if (trialActive) trialScore += 150;
          store.save();
          dObj.baseX = rand(-7.5, 7.5);
          dObj.g.position.y = rand(3.8, 4.6);
        } else if (hit.object.userData.bot) {
          const { bot, headshot } = hit.object.userData;
          if (w.pierce && damagedBotsThisShot.has(bot)) continue;
          damagedBotsThisShot.add(bot);

          const dmg = headshot ? w.dmgHead : w.dmgBody;
          bot.hp = Math.max(0, bot.hp - dmg);
          bot.hpFill.scale.x = Math.max(0.001, bot.hp / 100);

          if (headshot) {
            headshots++;
            audio.sfx.headshot();
          } else {
            audio.sfx.hitmark();
          }
          selectBot(bot, headshot);
          const pos = bot.g.position.clone().add(new THREE.Vector3(0, headshot ? 1.02 : 0.2, 0));
          fx.burst(pos, headshot ? '#ff5470' : w.color, headshot ? 30 : 14, 5.2, 0.16, 0.55);

          if (bot.hp <= 0 && bot.g.visible) {
            streak++;
            if (trialActive) trialScore += headshot ? 200 : 100;
            const sName = STREAK_NAMES[Math.min(STREAK_NAMES.length - 1, streak - 1)];
            fx.ring(pos, headshot ? '#ff5470' : bot.m.color, 2.2, 0.45);
            fx.pop(pos, headshot ? `⌖ ${sName}` : `${sName}`, headshot ? '#ff5470' : '#3dffb5');
            addKill(bot, headshot);
            store.markCleared(bot.m.id, false, headshot ? 40 : 20);
            bot.g.visible = false;
            bot.respawnAt = performance.now() + (trialActive ? 900 : 2200);
          } else if (bot.g.visible) {
            if (p === 0) fx.pop(pos, `-${dmg}`, w.color);
            gsap.fromTo(bot.g.scale, { x: 1.12, y: 0.9 }, { x: 1, y: 1, duration: 0.18 });
          }
        }
      }
    }

    if (anyHit) {
      hits++;
      hitmark.classList.add('show');
      setTimeout(() => hitmark.classList.remove('show'), 140);
    } else {
      streak = 0;
    }

    hitsEl.textContent = hits;
    hsEl.textContent = headshots;
    accEl.textContent = `${Math.round((hits / Math.max(1, shots)) * 100)}%`;
    strEl.textContent = streak;

    if (ammo <= 0) {
      setTimeout(() => reloadWeapon(), 180);
    }
  }

  onFrame((dt, t) => {
    if (!visible || blocked) return;

    if (input.keysPressed.has('Digit1')) setWeapon(0);
    if (input.keysPressed.has('Digit2')) setWeapon(1);
    if (input.keysPressed.has('Digit3')) setWeapon(2);
    if (input.keysPressed.has('KeyR')) reloadWeapon();
    if (input.keysPressed.has('KeyZ')) {
      scoped = !scoped;
      scopeOverlay.classList.toggle('open', scoped && weaponIdx === 1);
      audio.sfx.click();
    }

    if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);

    // 30s Aim Trial Countdown
    if (trialActive) {
      trialTime -= dt;
      if (trialTime <= 0) {
        trialActive = false;
        bestTrialScore = Math.max(bestTrialScore, trialScore);
        audio.sfx.win();
        trialBtn.textContent = `🏆 SCORE: ${trialScore} (BEST ${bestTrialScore}) · RETRY`;
      } else {
        trialBtn.textContent = `⏱️ ${trialTime.toFixed(1)}s · SCORE: ${trialScore}`;
      }
    }

    // Dynamic FOV for Sniper Scope Zoom vs Normal
    const targetFov = scoped ? (weaponIdx === 1 ? 26 : 42) : 54;
    camera.fov += (targetFov - camera.fov) * 0.22;
    camera.updateProjectionMatrix();
    camera.position.set(0, 0.6, 11.4);

    // Subtle parallax while keeping targets steady under the 1:1 mouse crosshair
    const aimX = input.ndc.x * (scoped ? 0.25 : 0.55);
    const aimY = 0.55 + input.ndc.y * (scoped ? 0.18 : 0.35);
    camera.lookAt(aimX, aimY, -3.8);

    // Animate Operator floating rail rings
    opRings.forEach((r, idx) => {
      r.rotation.z = t * (2.5 + idx);
      r.scale.setScalar(1 + Math.sin(t * 5 + idx) * 0.08);
    });

    // Update 3D Weapon Viewmodel position & kickback
    recoil = Math.max(0, recoil - dt * 2.4);
    const gunOffset = new THREE.Vector3(
      (scoped ? 0.35 : 0.95) + input.ndc.x * 0.16,
      -0.68 + input.ndc.y * 0.1 + recoil * 0.08,
      -1.35 + recoil * 0.28,
    );
    gunOffset.applyQuaternion(camera.quaternion);
    gun.position.copy(camera.position).add(gunOffset);
    gun.quaternion.copy(camera.quaternion);
    gun.rotateX(recoil * 0.42);

    // Animate aerial drones
    drones.forEach((d, idx) => {
      d.g.position.x = d.baseX + Math.sin(t * 1.8 + d.phase) * 2.4;
      d.g.position.y = 4.1 + Math.cos(t * 2.2 + idx) * 0.28;
      d.core.rotation.y = t * 2.5;
      d.ring.rotation.x = t * 1.8;
    });

    // Animate bots & respawn eliminated ones
    const now = performance.now();
    bots.forEach((b, idx) => {
      if (!b.g.visible && now >= b.respawnAt) {
        b.hp = 100;
        b.hpFill.scale.x = 1;
        b.g.visible = true;
        gsap.fromTo(b.g.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.32, ease: 'back.out(2)' });
      }
      const spd = trialActive ? 1.8 : 1.0;
      b.g.position.x = b.basePos.x + Math.sin(t * spd + idx) * (trialActive ? 0.55 : 0.22);
      b.g.position.y = b.basePos.y + Math.cos(t * 1.3 + idx) * 0.05;
      b.head.rotation.y = t * 1.4;
    });

    // Full-Auto Vandal fires continuously while holding LMB; Operator & Judge fire on click
    const w = WEAPONS[weaponIdx];
    if (w.auto ? input.down : input.pressed) {
      shoot();
    }

    if (selectedBot) {
      if (input.keysPressed.has('KeyE') || input.keysPressed.has('Enter')) {
        audio.sfx.click();
        onPlayMission(selectedBot.i);
      }
      if (input.keysPressed.has('KeyF')) {
        audio.sfx.click();
        onInspectMission(selectedBot.m);
      }
    }
  });

  return {
    show() {
      visible = true;
      root.visible = true;
      hud.style.display = 'block';
      hud.classList.add('open');
      setNebula('#1a0926', '#082d44', 0.48);
      document.body.style.cursor = 'none';
      xhair.style.left = `${mouseX}px`;
      xhair.style.top = `${mouseY}px`;
    },
    hide() {
      visible = false;
      root.visible = false;
      scoped = false;
      scopeOverlay.classList.remove('open');
      hud.style.display = 'none';
      hud.classList.remove('open');
      targetBox.classList.remove('open');
      document.body.style.cursor = '';
    },
    refresh() {
      bots.forEach((b) => {
        const clr = store.isCleared(b.m.id);
        b.torsoMat.color.set(clr ? '#11332a' : '#0b132b');
      });
    },
    set blocked(v) {
      blocked = v;
      if (v) {
        scoped = false;
        scopeOverlay.classList.remove('open');
      }
      document.body.style.cursor = v ? 'default' : visible ? 'none' : '';
    },
  };
}
