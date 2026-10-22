import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, onFrame } from '../engine/renderer.js';
import { input, pick, planePoint } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { glowMat, glowSprite, edgeLines, bodyMat, textSprite, rand } from '../engine/helpers.js';
import { missions } from '../data/content.js';
import { store } from '../engine/store.js';
import { setNebula } from './background.js';

const pad = (n) => String(n).padStart(2, '0');
const STREAK_NAMES = ['FIRST BLOOD', 'DOUBLE KILL', 'TRIPLE KILL', 'QUADRA KILL', 'ACE // RADIANT!'];

export function createShooterWorld({ onPlayMission, onInspectMission }) {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // ── Firing Range Floor & Lane Dividers ──
  const floorGeo = new THREE.PlaneGeometry(60, 40);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x050916, transparent: true, opacity: 0.88 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.4;
  root.add(floor);

  for (let i = -5; i <= 5; i++) {
    const lane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 34),
      glowMat(i % 2 === 0 ? '#22e4ff' : '#b07cff', 1.2, 0.3),
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(i * 3.2, -3.38, -8);
    root.add(lane);
  }

  // Range Header Banner
  const rangeHdr = textSprite('VALORANT // CS2 TACTICAL PORTFOLIO RANGE — SHOOT TARGETS TO UNLOCK', {
    worldH: 0.55, width: 1200, height: 84, font: '700 32px "JetBrains Mono"', color: '#22e4ff',
  });
  rangeHdr.sprite.position.set(0, 4.45, -4);
  root.add(rangeHdr.sprite);

  // ── 10 Holographic Mission Target Bots ──
  const bots = [];
  const hitObjects = [];
  const torsoGeo = new THREE.BoxGeometry(1.15, 1.45, 0.35);
  const headGeo = new THREE.OctahedronGeometry(0.38, 1);

  missions.forEach((m, i) => {
    const row = i < 5 ? 0 : 1;
    const col = i % 5;
    const x = (col - 2) * 3.15 + (row === 1 ? 0 : 0);
    const y = row === 0 ? 1.15 : -1.55;
    const z = row === 0 ? -3.2 : -1.2;

    const g = new THREE.Group();
    g.position.set(x, y, z);

    const torso = new THREE.Mesh(torsoGeo, bodyMat('#0b1630', 0.92));
    const torsoEdge = edgeLines(torsoGeo, m.color, 1.8);
    const head = new THREE.Mesh(headGeo, glowMat(m.color, 1.8));
    head.position.y = 1.12;
    const headHalo = glowSprite(m.color, 1.5, 0.5);
    headHalo.position.y = 1.12;

    const numTxt = textSprite(pad(m.n), {
      worldH: 0.52, width: 220, height: 96, font: '700 64px "JetBrains Mono"', color: '#ffffff',
    });
    numTxt.sprite.position.set(0, 0.15, 0.22);

    const titleTxt = textSprite(m.title.toUpperCase(), {
      worldH: 0.32, width: 480, height: 72, font: '700 34px "JetBrains Mono"', color: m.color,
    });
    titleTxt.sprite.position.set(0, -0.42, 0.22);

    // Generous hitboxes for head & body
    const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
    headHit.position.y = 1.12;
    const bodyHit = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.65, 0.6), new THREE.MeshBasicMaterial({ visible: false }));

    g.add(torso, torsoEdge, head, headHalo, numTxt.sprite, titleTxt.sprite, headHit, bodyHit);
    root.add(g);

    const bot = { m, i, g, head, torsoEdge, basePos: new THREE.Vector3(x, y, z), hp: 2, respawnAt: 0 };
    headHit.userData = { bot, headshot: true };
    bodyHit.userData = { bot, headshot: false };
    hitObjects.push(headHit, bodyHit);
    bots.push(bot);
  });

  // ── Bonus Flick Orb (Aim Lab Reflex Target) ──
  const flickGroup = new THREE.Group();
  const flickGeo = new THREE.SphereGeometry(0.42, 24, 24);
  const flickMesh = new THREE.Mesh(flickGeo, glowMat('#3dffb5', 2.2));
  const flickHalo = glowSprite('#3dffb5', 1.8, 0.65);
  const flickHit = new THREE.Mesh(new THREE.SphereGeometry(0.65, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  flickGroup.add(flickMesh, flickHalo, flickHit);
  flickGroup.position.set(0, 2.85, -2.5);
  root.add(flickGroup);
  flickHit.userData = { flick: true };
  hitObjects.push(flickHit);

  // ── 3D First-Person Pulse Rifle Viewmodel ──
  const gun = new THREE.Group();
  const barrelGeo = new THREE.BoxGeometry(0.16, 0.18, 1.35);
  const barrel = new THREE.Mesh(barrelGeo, bodyMat('#0c1734', 0.96));
  const barrelEdge = edgeLines(barrelGeo, '#22e4ff', 2.0);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 1.25), glowMat('#3dffb5', 2.2));
  rail.position.y = 0.11;
  const muzzle = glowSprite('#22e4ff', 1.2, 0);
  muzzle.position.set(0, 0.04, -0.75);
  gun.add(barrel, barrelEdge, rail, muzzle);
  root.add(gun);

  // ── Tactical Shooter HUD (Crosshair, Killfeed, Target Dossier Action Bar, Aim Stats) ──
  const hud = document.createElement('div');
  hud.className = 'shooter-hud';
  hud.setAttribute('data-ui', '');
  hud.style.display = 'none'; // Initially hidden
  hud.innerHTML = `
    <div class="xhair" id="xhair">
      <i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><span class="dot"></span>
      <div class="hitmark" id="hitmark">✕</div>
    </div>
    <div class="sh-stats">
      <div><span>HITS</span><b id="sh-hits">0</b></div>
      <div><span>HEADSHOTS</span><b id="sh-hs">0</b></div>
      <div><span>ACCURACY</span><b id="sh-acc">100%</b></div>
      <div><span>STREAK</span><b id="sh-str">0</b></div>
    </div>
    <div class="killfeed" id="killfeed"></div>
    <div class="sh-target" id="sh-target">
      <div class="sht-head"><b id="sht-num">01</b><span id="sht-title">HELLO, WORLD</span><em id="sht-tag">TARGET ACQUIRED</em></div>
      <p id="sht-desc"></p>
      <div class="sht-btns">
        <button type="button" class="btn primary small" id="sht-play">▶ PLAY MINI-GAME [E]</button>
        <button type="button" class="btn small" id="sht-read">📖 VIEW STORY, CERTS & SKILLS [F]</button>
      </div>
    </div>`;
  document.getElementById('ui').appendChild(hud);

  const xhair = hud.querySelector('#xhair');
  const hitmark = hud.querySelector('#hitmark');
  const killfeed = hud.querySelector('#killfeed');
  const targetBox = hud.querySelector('#sh-target');
  const hitsEl = hud.querySelector('#sh-hits');
  const hsEl = hud.querySelector('#sh-hs');
  const accEl = hud.querySelector('#sh-acc');
  const strEl = hud.querySelector('#sh-str');

  let selectedBot = null;
  let shots = 0, hits = 0, headshots = 0, streak = 0;
  let visible = false, blocked = false;
  let recoil = 0;

  function selectBot(bot, hs) {
    selectedBot = bot;
    hud.querySelector('#sht-num').textContent = pad(bot.m.n);
    hud.querySelector('#sht-title').textContent = bot.m.title.toUpperCase();
    hud.querySelector('#sht-tag').textContent = hs ? '⌖ HEADSHOT UNLOCKED!' : 'TARGET LOCKED';
    hud.querySelector('#sht-desc').textContent = bot.m.story.slice(0, 140) + '…';
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

  hud.querySelector('#sht-play').addEventListener('click', () => {
    if (selectedBot) { audio.sfx.click(); onPlayMission(selectedBot.i); }
  });
  hud.querySelector('#sht-read').addEventListener('click', () => {
    if (selectedBot) { audio.sfx.click(); onInspectMission(selectedBot.m); }
  });

  function fireTracer(toWorld, color = '#22e4ff') {
    const start = gun.position.clone().add(new THREE.Vector3(0, 0.04, -0.6));
    const pts = [start, toWorld.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.4), transparent: true, opacity: 0.95, toneMapped: false });
    const line = new THREE.Line(geo, mat);
    root.add(line);
    gsap.to(mat, { opacity: 0, duration: 0.18, onComplete: () => { root.remove(line); geo.dispose(); mat.dispose(); } });
  }

  function shoot() {
    shots++;
    recoil = 0.22;
    muzzle.material.opacity = 0.95;
    gsap.to(muzzle.material, { opacity: 0, duration: 0.1 });
    audio.sfx.shot();

    const hit = pick(hitObjects, false);
    const aimPt = hit ? hit.point : planePoint(-3);
    fireTracer(aimPt, hit?.object.userData.headshot ? '#ff5470' : '#22e4ff');

    if (hit) {
      hits++;
      streak++;
      hitmark.classList.add('show');
      setTimeout(() => hitmark.classList.remove('show'), 140);

      if (hit.object.userData.flick) {
        audio.sfx.headshot();
        fx.burst(flickGroup.position.clone(), '#3dffb5', 30, 5.5, 0.18, 0.65);
        fx.pop(flickGroup.position.clone(), '+FLICK HIT! +25 XP', '#3dffb5');
        store.state.xp += 25;
        store.save();
        flickGroup.position.set(rand(-5.2, 5.2), rand(2.2, 3.4), rand(-3.5, -1.5));
      } else if (hit.object.userData.bot) {
        const { bot, headshot } = hit.object.userData;
        if (headshot) {
          headshots++;
          audio.sfx.headshot();
          bot.hp = 0;
        } else {
          audio.sfx.hitmark();
          bot.hp--;
        }
        selectBot(bot, headshot);
        const pos = bot.g.position.clone().add(new THREE.Vector3(0, headshot ? 1.1 : 0.2, 0));
        fx.burst(pos, headshot ? '#ff5470' : bot.m.color, headshot ? 48 : 24, 6, 0.2, 0.75);
        fx.ring(pos, headshot ? '#ff5470' : bot.m.color, headshot ? 2.4 : 1.5, 0.5);

        if (bot.hp <= 0) {
          const sName = STREAK_NAMES[Math.min(STREAK_NAMES.length - 1, streak - 1)];
          fx.pop(pos, headshot ? `⌖ HEADSHOT! · ${sName}` : `TARGET DOWN! · ${sName}`, headshot ? '#ff5470' : '#3dffb5');
          addKill(bot, headshot);
          store.markCleared(bot.m.id, false, headshot ? 40 : 20);
          bot.g.visible = false;
          bot.respawnAt = performance.now() + 2600;
        } else {
          fx.pop(pos, 'SHIELD CRACKED · SHOOT AGAIN!', '#ffc23d');
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

    // Position crosshair at pointer
    xhair.style.transform = `translate3d(${input.px}px, ${input.py}px, 0) translate(-50%, -50%) scale(${1 + recoil * 1.4})`;

    // Subtle camera sway with mouse aim
    camera.position.set(input.ndc.x * 1.2, 0.4 + input.ndc.y * 0.65, 9.5);
    camera.lookAt(input.ndc.x * 2.6, input.ndc.y * 1.6, 0);

    // Position 3D viewmodel rifle relative to camera
    recoil = Math.max(0, recoil - dt * 2.2);
    gun.position.set(
      camera.position.x + 0.85 + input.ndc.x * 0.25,
      camera.position.y - 0.65 + input.ndc.y * 0.18 + recoil * 0.12,
      camera.position.z - 1.65 + recoil * 0.35,
    );
    gun.rotation.set(recoil * 0.45 + input.ndc.y * 0.12, -input.ndc.x * 0.22, 0);

    // Animate bots & respawn eliminated ones
    const now = performance.now();
    bots.forEach((b, idx) => {
      if (!b.g.visible && now >= b.respawnAt) {
        b.hp = 2;
        b.g.visible = true;
        gsap.fromTo(b.g.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.35, ease: 'back.out(2)' });
      }
      b.g.position.x = b.basePos.x + Math.sin(t * 1.4 + idx) * 0.38;
      b.g.position.y = b.basePos.y + Math.cos(t * 1.8 + idx) * 0.08;
      b.head.rotation.y = t * 1.6;
    });

    if (input.pressed) shoot();
    if (selectedBot) {
      if (input.keysPressed.has('KeyE')) onPlayMission(selectedBot.i);
      if (input.keysPressed.has('KeyF')) onInspectMission(selectedBot.m);
    }
  });

  return {
    show() {
      visible = true;
      root.visible = true;
      hud.style.display = 'block';
      hud.classList.add('open');
      setNebula('#1f0a2e', '#0a3854', 0.56);
      document.body.style.cursor = 'none';
    },
    hide() {
      visible = false;
      root.visible = false;
      hud.style.display = 'none';
      hud.classList.remove('open');
      targetBox.classList.remove('open');
      document.body.style.cursor = '';
    },
    refresh() {
      bots.forEach((b) => {
        const clr = store.isCleared(b.m.id);
        b.torsoMat.color.set(clr ? '#3dffb5' : b.m.color);
      });
    },
    set blocked(v) {
      blocked = v;
      document.body.style.cursor = v ? 'default' : visible ? 'none' : '';
    },
  };
}
