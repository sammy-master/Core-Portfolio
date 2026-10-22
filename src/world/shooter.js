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
const STREAK_NAMES = ['FIRST BLOOD', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', 'ACE // RADIANT!'];

const WEAPONS = [
  { id: 'vandal', name: 'VANDAL // PULSE RIFLE', dmgHead: 160, dmgBody: 55, color: '#22e4ff', recoilAmt: 0.18 },
  { id: 'operator', name: 'OPERATOR // RAIL SNIPER', dmgHead: 255, dmgBody: 150, color: '#ff4fa3', recoilAmt: 0.34 },
  { id: 'sheriff', name: 'SHERIFF // HEAVY REVOLVER', dmgHead: 159, dmgBody: 65, color: '#ffc23d', recoilAmt: 0.25 },
];

export function createShooterWorld({ onPlayMission, onInspectMission, onToast }) {
  const canvas = document.getElementById('gl');
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  const raycaster = new THREE.Raycaster();
  const aimNdc = new THREE.Vector2();

  // ── Firing Range Floor & Lane Dividers ──
  const floorGeo = new THREE.PlaneGeometry(66, 44);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x050916, transparent: true, opacity: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.4;
  root.add(floor);

  for (let i = -5; i <= 5; i++) {
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 36),
      glowMat(i % 2 === 0 ? '#22e4ff' : '#b07cff', 1.2, 0.32),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(i * 3.3, -3.38, -8);
    root.add(lane);
  }

  // Range Header Banner
  const rangeHdr = textSprite('VALORANT // CS2 TACTICAL PORTFOLIO RANGE — SHOOT TARGETS TO UNLOCK', {
    worldH: 0.58, width: 1200, height: 84, font: '700 32px "JetBrains Mono"', color: '#22e4ff',
  });
  rangeHdr.sprite.position.set(0, 4.55, -4.5);
  root.add(rangeHdr.sprite);

  // ── 10 Holographic Mission Target Bots ──
  const bots = [];
  const hitObjects = [];
  const torsoGeo = new THREE.BoxGeometry(1.2, 1.5, 0.38);
  const headGeo = new THREE.OctahedronGeometry(0.42, 1);

  missions.forEach((m, i) => {
    const row = i < 5 ? 0 : 1;
    const col = i % 5;
    const x = (col - 2) * 3.35;
    const y = row === 0 ? 1.2 : -1.5;
    const z = row === 0 ? -3.4 : -1.4;

    const g = new THREE.Group();
    g.position.set(x, y, z);

    const torsoMat = bodyMat('#0d1632', 0.94);
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    const torsoEdge = edgeLines(torsoGeo, m.color, 1.9);

    const headMat = glowMat(m.color, 2.0, 0.9);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.15;
    const headRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.56, 32), glowMat('#ff5470', 2.0, 0.85));
    headRing.position.set(0, 1.15, 0.05);

    const numTxt = textSprite(`${pad(m.n)} · ${m.title.toUpperCase()}`, {
      worldH: 0.38, width: 540, height: 74, font: '700 34px "JetBrains Mono"', color: '#ffffff',
    });
    numTxt.sprite.position.set(0, 1.85, 0.1);

    const subTxt = textSprite(m.year, {
      worldH: 0.28, width: 320, height: 56, font: '600 28px "JetBrains Mono"', color: m.color,
    });
    subTxt.sprite.position.set(0, 0.15, 0.24);

    const bodyHit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.75, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
    headHit.position.y = 1.15;

    g.add(torso, torsoEdge, head, headRing, numTxt.sprite, subTxt.sprite, bodyHit, headHit);
    root.add(g);

    const bot = { m, i, g, torsoMat, torsoEdge, head, headRing, basePos: g.position.clone(), hp: 100, respawnAt: 0 };
    bodyHit.userData = { bot, headshot: false };
    headHit.userData = { bot, headshot: true };
    bots.push(bot);
    hitObjects.push(bodyHit, headHit);
  });

  // Bonus Flick Orb Target
  const flickGroup = new THREE.Group();
  const flickMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), glowMat('#3dffb5', 2.4));
  const flickHit = new THREE.Mesh(new THREE.SphereGeometry(0.72, 10, 10), new THREE.MeshBasicMaterial({ visible: false }));
  flickHit.userData = { flick: true };
  flickGroup.add(flickMesh, flickHit);
  flickGroup.position.set(0, 3.0, -2.5);
  root.add(flickGroup);
  hitObjects.push(flickHit);

  // ── 3D First-Person Pulse Rifle Viewmodel (attached to Camera view) ──
  const gun = new THREE.Group();
  const barrelGeo = new THREE.BoxGeometry(0.18, 0.22, 1.45);
  const barrel = new THREE.Mesh(barrelGeo, bodyMat('#0a1329', 0.96));
  const barrelEdge = edgeLines(barrelGeo, '#22e4ff', 2.0);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 1.3), glowMat('#3dffb5', 2.2));
  rail.position.y = 0.12;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 12), bodyMat('#132247', 0.95));
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.18, 0.1);
  const muzzle = glowSprite('#22e4ff', 1.4, 0);
  muzzle.position.set(0, 0.04, -0.8);
  gun.add(barrel, barrelEdge, rail, scope, muzzle);
  root.add(gun);

  // ── Tactical Shooter HUD ──
  const hud = document.createElement('div');
  hud.className = 'shooter-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none';
  hud.innerHTML = `
    <!-- High-Contrast Valorant Crosshair -->
    <div class="xhair" id="xhair">
      <i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><span class="dot"></span>
      <div class="hitmark" id="hitmark">✕</div>
    </div>

    <!-- Top Stats & Pointer Lock Toggle -->
    <div class="sh-stats">
      <div><span>HITS</span><b id="sh-hits">0</b></div>
      <div><span>HEADSHOTS</span><b id="sh-hs">0</b></div>
      <div><span>ACCURACY</span><b id="sh-acc">100%</b></div>
      <div><span>STREAK</span><b id="sh-str">0</b></div>
      <button type="button" class="sh-lock-btn" id="sh-lock-btn">🎯 CLICK TO LOCK MOUSE AIM (FPS MODE)</button>
    </div>

    <!-- Killfeed -->
    <div class="killfeed" id="killfeed"></div>

    <!-- Target Locked Action Card -->
    <div class="sh-target" id="sh-target">
      <div class="sht-head"><b id="sht-num">01</b><span id="sht-title">HELLO, WORLD</span><em id="sht-tag">TARGET ACQUIRED</em></div>
      <p id="sht-desc"></p>
      <div class="sht-btns">
        <button type="button" class="btn primary small" id="sht-play">▶ PLAY MINI-GAME [E]</button>
        <button type="button" class="btn small" id="sht-read">📖 VIEW STORY, CERTS & SKILLS [F]</button>
      </div>
    </div>

    <!-- Weapon Loadout Bar (Bottom Right) -->
    <div class="sh-loadout" id="sh-loadout">
      <button type="button" class="sh-wbtn active" data-w="0"><b>[1]</b> VANDAL</button>
      <button type="button" class="sh-wbtn" data-w="1"><b>[2]</b> OPERATOR</button>
      <button type="button" class="sh-wbtn" data-w="2"><b>[3]</b> SHERIFF</button>
    </div>`;
  document.getElementById('ui').appendChild(hud);

  const xhair = hud.querySelector('#xhair');
  const hitmark = hud.querySelector('#hitmark');
  const killfeed = hud.querySelector('#killfeed');
  const targetBox = hud.querySelector('#sh-target');
  const lockBtn = hud.querySelector('#sh-lock-btn');
  const hitsEl = hud.querySelector('#sh-hits');
  const hsEl = hud.querySelector('#sh-hs');
  const accEl = hud.querySelector('#sh-acc');
  const strEl = hud.querySelector('#sh-str');

  let selectedBot = null;
  let shots = 0, hits = 0, headshots = 0, streak = 0;
  let visible = false, blocked = false;
  let recoil = 0;
  let weaponIdx = 0;
  let yaw = 0, pitch = 0;
  let isLocked = false;

  function setWeapon(idx) {
    weaponIdx = idx;
    const w = WEAPONS[weaponIdx];
    barrelEdge.material.color.set(w.color);
    hud.querySelectorAll('.sh-wbtn').forEach((b, i) => b.classList.toggle('active', i === idx));
    audio.sfx.click();
  }

  hud.querySelectorAll('.sh-wbtn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setWeapon(Number(btn.dataset.w));
    });
  });

  // Pointer lock management so cursor never leaves the window during FPS aiming
  function requestLock() {
    if (!visible || blocked) return;
    try { canvas.requestPointerLock?.(); } catch { /* ignore */ }
  }
  function exitLock() {
    if (document.pointerLockElement === canvas) {
      try { document.exitPointerLock?.(); } catch { /* ignore */ }
    }
  }

  document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === canvas;
    if (isLocked) {
      lockBtn.textContent = '🔒 FPS MOUSE LOCKED · [E] PLAY · [F] STORY · [ESC] UNLOCK';
      lockBtn.classList.add('locked');
      xhair.style.left = '50%';
      xhair.style.top = '50%';
    } else {
      lockBtn.textContent = '🎯 CLICK RANGE TO LOCK MOUSE AIM (OR AIM WITH CURSOR)';
      lockBtn.classList.remove('locked');
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!visible || blocked) return;
    if (document.pointerLockElement === canvas) {
      yaw = THREE.MathUtils.clamp(yaw - e.movementX * 0.0022, -0.58, 0.58);
      pitch = THREE.MathUtils.clamp(pitch - e.movementY * 0.0022, -0.38, 0.38);
    } else {
      // Follow cursor directly so crosshair is 100% aligned with mouse
      xhair.style.left = `${e.clientX}px`;
      xhair.style.top = `${e.clientY}px`;
    }
  });

  lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isLocked) exitLock();
    else requestLock();
  });

  function selectBot(bot, hs) {
    selectedBot = bot;
    hud.querySelector('#sht-num').textContent = `CHAPTER ${pad(bot.m.n)}`;
    hud.querySelector('#sht-title').textContent = bot.m.title.toUpperCase();
    hud.querySelector('#sht-tag').textContent = hs ? '⌖ HEADSHOT UNLOCKED!' : 'TARGET LOCKED';
    hud.querySelector('#sht-desc').textContent = bot.m.story.slice(0, 135) + '…';
    targetBox.classList.add('open');
  }

  function addKill(bot, hs) {
    const item = document.createElement('div');
    item.className = 'kf-item' + (hs ? ' hs' : '');
    item.innerHTML = `<span class="me">SAKSHAM</span><i>${hs ? '⌖ HEADSHOT' : '︻デ═一'}</i><span class="victim">${pad(bot.m.n)} · ${bot.m.title}</span>`;
    killfeed.prepend(item);
    while (killfeed.children.length > 4) killfeed.lastElementChild.remove();
    gsap.fromTo(item, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25 });
    gsap.to(item, { opacity: 0, duration: 0.4, delay: 4.0, onComplete: () => item.remove() });
  }

  hud.querySelector('#sht-play').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedBot) {
      exitLock();
      audio.sfx.click();
      onPlayMission(selectedBot.i);
    }
  });
  hud.querySelector('#sht-read').addEventListener('click', (e) => {
    e.stopPropagation();
    if (selectedBot) {
      exitLock();
      audio.sfx.click();
      onInspectMission(selectedBot.m);
    }
  });

  function fireTracer(toWorld, color = '#22e4ff') {
    const start = gun.position.clone().add(new THREE.Vector3(0, 0.04, -0.6));
    const pts = [start, toWorld.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4), transparent: true, opacity: 0.95, toneMapped: false });
    const line = new THREE.Line(geo, mat);
    root.add(line);
    gsap.to(mat, { opacity: 0, duration: 0.2, onComplete: () => { root.remove(line); geo.dispose(); mat.dispose(); } });
  }

  function shoot() {
    const w = WEAPONS[weaponIdx];
    shots++;
    recoil = w.recoilAmt;
    xhair.classList.add('recoil');
    setTimeout(() => xhair.classList.remove('recoil'), 95);
    muzzle.material.opacity = 0.95;
    gsap.to(muzzle.material, { opacity: 0, duration: 0.1 });
    audio.sfx.shot();

    // Raycast from EXACT crosshair coordinates:
    // If pointer locked -> center of screen (0, 0)
    // If unlocked -> current mouse NDC (input.ndc)
    if (isLocked) {
      aimNdc.set(0, 0);
    } else {
      aimNdc.copy(input.ndc);
    }
    raycaster.setFromCamera(aimNdc, camera);
    const hitsList = raycaster.intersectObjects(hitObjects, false);
    const hit = hitsList[0] || null;

    const fallbackPt = new THREE.Vector3();
    raycaster.ray.at(16, fallbackPt);
    const aimPt = hit ? hit.point : fallbackPt;
    fireTracer(aimPt, hit?.object.userData.headshot ? '#ff5470' : w.color);

    if (hit) {
      hits++;
      streak++;
      hitmark.classList.add('show');
      setTimeout(() => hitmark.classList.remove('show'), 150);

      if (hit.object.userData.flick) {
        audio.sfx.headshot();
        fx.burst(flickGroup.position.clone(), '#3dffb5', 32, 5.5, 0.18, 0.65);
        fx.pop(flickGroup.position.clone(), '+FLICK BONUS! +30 XP', '#3dffb5');
        store.state.xp += 30;
        store.save();
        flickGroup.position.set(rand(-5.2, 5.2), rand(2.2, 3.4), rand(-3.5, -1.5));
      } else if (hit.object.userData.bot) {
        const { bot, headshot } = hit.object.userData;
        const dmg = headshot ? w.dmgHead : w.dmgBody;
        bot.hp -= dmg;
        if (headshot) {
          headshots++;
          audio.sfx.headshot();
        } else {
          audio.sfx.hitmark();
        }
        selectBot(bot, headshot);
        const pos = bot.g.position.clone().add(new THREE.Vector3(0, headshot ? 1.15 : 0.2, 0));
        fx.burst(pos, headshot ? '#ff5470' : bot.m.color, headshot ? 45 : 22, 6, 0.2, 0.75);
        fx.ring(pos, headshot ? '#ff5470' : bot.m.color, headshot ? 2.4 : 1.5, 0.5);

        if (bot.hp <= 0) {
          const sName = STREAK_NAMES[Math.min(STREAK_NAMES.length - 1, streak - 1)];
          fx.pop(pos, headshot ? `⌖ ${dmg} HEADSHOT! · ${sName}` : `${dmg} ELIMINATED! · ${sName}`, headshot ? '#ff5470' : '#3dffb5');
          addKill(bot, headshot);
          store.markCleared(bot.m.id, false, headshot ? 40 : 20);
          bot.g.visible = false;
          bot.respawnAt = performance.now() + 2400;
        } else {
          fx.pop(pos, `-${dmg} HP · SHOOT AGAIN!`, '#ffc23d');
          gsap.fromTo(bot.g.scale, { x: 1.18, y: 0.88 }, { x: 1, y: 1, duration: 0.25 });
        }
      }
    } else {
      streak = 0;
    }

    hitsEl.textContent = hits;
    hsEl.textContent = headshots;
    accEl.textContent = `${Math.round((hits / Math.max(1, shots)) * 100)}%`;
    strEl.textContent = streak;
  }

  onFrame((dt, t) => {
    if (!visible || blocked) return;

    // Weapon hotkeys
    if (input.keysPressed.has('Digit1')) setWeapon(0);
    if (input.keysPressed.has('Digit2')) setWeapon(1);
    if (input.keysPressed.has('Digit3')) setWeapon(2);

    // Camera aim rotation:
    // If pointer locked -> controlled by yaw & pitch
    // If unlocked -> gentle parallax toward cursor
    camera.fov = weaponIdx === 1 ? 38 : 52;
    camera.updateProjectionMatrix();
    camera.position.set(0, 0.35, 9.8);

    const aimX = isLocked ? Math.tan(yaw) * 12 : input.ndc.x * 2.8;
    const aimY = isLocked ? Math.tan(pitch) * 10 : input.ndc.y * 1.8;
    camera.lookAt(aimX, aimY, -3.0);

    // Update 3D Rifle viewmodel to follow camera aim
    recoil = Math.max(0, recoil - dt * 2.4);
    const gunOffset = new THREE.Vector3(0.65, -0.52 + recoil * 0.1, -1.45 + recoil * 0.32);
    gunOffset.applyQuaternion(camera.quaternion);
    gun.position.copy(camera.position).add(gunOffset);
    gun.quaternion.copy(camera.quaternion);
    gun.rotateX(recoil * 0.45);

    // Animate bots & respawn eliminated ones
    const now = performance.now();
    bots.forEach((b, idx) => {
      if (!b.g.visible && now >= b.respawnAt) {
        b.hp = 100;
        b.g.visible = true;
        gsap.fromTo(b.g.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2)' });
      }
      b.g.position.x = b.basePos.x + Math.sin(t * 1.25 + idx) * 0.35;
      b.g.position.y = b.basePos.y + Math.cos(t * 1.6 + idx) * 0.07;
      b.head.rotation.y = t * 1.6;
    });

    if (input.pressed) {
      if (!isLocked) requestLock();
      shoot();
    }
    if (selectedBot) {
      if (input.keysPressed.has('KeyE') || input.keysPressed.has('Enter')) {
        exitLock();
        audio.sfx.click();
        onPlayMission(selectedBot.i);
      }
      if (input.keysPressed.has('KeyF')) {
        exitLock();
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
      setNebula('#1f0a2e', '#0a3854', 0.56);
      document.body.style.cursor = 'crosshair';
      xhair.style.left = '50%';
      xhair.style.top = '50%';
    },
    hide() {
      visible = false;
      root.visible = false;
      exitLock();
      hud.style.display = 'none';
      hud.classList.remove('open');
      targetBox.classList.remove('open');
      document.body.style.cursor = '';
    },
    refresh() {
      bots.forEach((b) => {
        const clr = store.isCleared(b.m.id);
        b.torsoMat.color.set(clr ? '#13382e' : '#0d1632');
      });
    },
    set blocked(v) {
      blocked = v;
      if (v) exitLock();
      document.body.style.cursor = v ? 'default' : visible ? 'crosshair' : '';
    },
  };
}
