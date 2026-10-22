import './style.css';
import gsap from 'gsap';
import { scene, onFrame, onBeforeRender, onAfterRender, startLoop, globalU } from './engine/renderer.js';
import { initInput, endFrame, planePoint } from './engine/input.js';
import { fx } from './engine/fx.js';
import { audio } from './engine/audio.js';
import { store } from './engine/store.js';
import { missions } from './data/content.js';
import { createTitle } from './world/title.js';
import { createHub } from './world/hub.js';
import { createDriveWorld } from './world/drive.js';
import { createShooterWorld } from './world/shooter.js';
import { createMissionRunner } from './world/mission.js';
import { ui } from './ui/ui.js';

initInput();
audio.setMuted(!!store.state.muted);

// Build 3D systems
const runner = createMissionRunner();

const hub = createHub({
  onSelect: (idx) => launchMission(idx),
  onInspect: (m) => ui.reveal(m, { skipped: false, first: false }),
  onToast: (msg) => ui.toast(msg),
});
hub.hide();

const drive = createDriveWorld({
  onPlayMission: (idx) => launchMission(idx),
  onSelectMission: (idx) => launchMission(idx),
  onInspectMission: (m) => ui.reveal(m, { skipped: false, first: false }),
  onToast: (msg) => ui.toast(msg),
});
drive.hide();

const shooter = createShooterWorld({
  onPlayMission: (idx) => launchMission(idx),
  onInspectMission: (m) => ui.reveal(m, { skipped: false, first: false }),
  onToast: (msg) => ui.toast(msg),
});
shooter.hide();

// Particle title screen in 3D
const title = createTitle(['SAKSHAM', 'SHARMA']);
title.group.position.set(0, 1.35, 0);
scene.add(title.group);

document.fonts?.ready?.then(() => {
  title.form(2.4);
});
title.form(2.4);

function showActiveWorld() {
  const mode = store.state.worldMode || 'orrery';
  if (mode === 'drive') {
    hub.hide();
    shooter.hide();
    drive.show();
    drive.refresh();
  } else if (mode === 'shooter') {
    hub.hide();
    drive.hide();
    shooter.show();
    shooter.refresh();
  } else {
    drive.hide();
    shooter.hide();
    hub.show();
    hub.refresh();
  }
}

function hideAllWorlds() {
  hub.hide();
  drive.hide();
  shooter.hide();
}

function refreshAllWorlds() {
  hub.refresh();
  drive.refresh();
  shooter.refresh();
}

function setWorldMode(mode) {
  if (runner.active) runner.exit();
  ui.closeAll();
  store.setWorldMode(mode);
  globalU.uWarp.value = 0.45;
  gsap.to(globalU.uWarp, { value: 0, duration: 0.7, ease: 'power3.out' });
  showActiveWorld();
  chrome.update();
  const labels = {
    orrery: '🌌 SOLAR CORE — Drag to rotate · Scroll to zoom · Click any planet or pill below',
    drive: '🏎️ FORZA PLAYGROUND — WASD to drive · [H] Shockwave · Click top GPS pills to teleport',
    shooter: '🎯 TACTICAL FPS RANGE — Aim & click to shoot · [1][2][3] Weapons · [E] Play · [F] Story',
  };
  ui.toast(labels[mode] || 'Mode switched');
}

const actions = {
  card: () => { ui.closeAll(); ui.card(); },
  vault: () => { ui.closeAll(); ui.vault(); },
  certs: () => { ui.closeAll(); ui.certs(); },
  blogs: () => { ui.closeAll(); ui.blogs(); },
  contact: () => { ui.closeAll(); ui.contact(); },
  recruiter: () => { ui.closeAll(); ui.recruiter(actions); },
  pause: () => { ui.closeAll(); ui.pauseMenu(actions); },
  setMode: (mode) => setWorldMode(mode),
  playMission: (idx) => {
    ui.closeAll();
    launchMission(idx);
  },
  inspectMission: (m) => {
    ui.closeAll();
    ui.reveal(m, { skipped: false, first: false });
  },
};

const chrome = ui.chrome(actions);
ui.onPanel(
  () => {
    hub.blocked = true;
    drive.blocked = true;
    shooter.blocked = true;
  },
  (_entry, remaining) => {
    if (remaining === 0) {
      hub.blocked = false;
      drive.blocked = false;
      shooter.blocked = false;
      chrome.update();
    }
  },
);

let inBoot = true;
const bootEl = document.getElementById('boot');

async function exitBoot({ openRecruiter = false, initialMode = null } = {}) {
  if (!inBoot) return;
  inBoot = false;
  if (initialMode) {
    store.setWorldMode(initialMode);
  }
  audio.init();
  audio.sfx.boot();
  gsap.to(bootEl, { autoAlpha: 0, duration: 0.4, onComplete: () => bootEl.remove() });
  globalU.uWarp.value = 0.75;
  gsap.to(globalU.uWarp, { value: 0, duration: 1.0, ease: 'power3.out' });
  await title.explode(0.85);
  scene.remove(title.group);
  title.dispose();

  showActiveWorld();
  chrome.show();
  chrome.update();

  if (openRecruiter) {
    ui.recruiter(actions);
  } else if (!store.state.intro && store.state.worldMode === 'orrery') {
    store.state.intro = true;
    store.save();
    await ui.briefing(actions);
  }
}

document.getElementById('boot-enter')?.addEventListener('click', () => exitBoot({ initialMode: 'orrery' }));
document.getElementById('boot-drive')?.addEventListener('click', () => exitBoot({ initialMode: 'drive' }));
document.getElementById('boot-shooter')?.addEventListener('click', () => exitBoot({ initialMode: 'shooter' }));
document.getElementById('boot-recruiter')?.addEventListener('click', () => exitBoot({ openRecruiter: true, initialMode: 'orrery' }));

async function launchMission(idx) {
  const m = missions[idx];
  if (!m || runner.active) return;
  ui.closeAll();
  chrome.hide();
  chrome.hideHint();

  const mode = store.state.worldMode || 'orrery';
  if (mode === 'orrery') {
    await hub.dive(idx);
  } else {
    globalU.uWarp.value = 0.65;
    gsap.to(globalU.uWarp, { value: 0, duration: 0.65, ease: 'power2.out' });
  }
  hideAllWorlds();

  const res = await runner.start(m);

  showActiveWorld();
  if (mode === 'orrery') {
    hub.settle();
  }
  chrome.show();

  if (res.result === 'win' || res.result === 'skip') {
    const skipped = res.result === 'skip';
    const first = store.markCleared(m.id, skipped, res.bonus || 0);
    refreshAllWorlds();
    chrome.update();

    if (mode === 'orrery') {
      hub.awardShards(m);
      hub.shift(-3.2, 0.75);
    }
    await ui.reveal(m, { bonus: res.bonus || 0, skipped, first });
    if (mode === 'orrery') {
      hub.shift(0, 0.75);
    }

    if (store.clearedCount() >= missions.length && first) {
      ui.finale(actions);
    }
  } else {
    refreshAllWorlds();
    chrome.update();
  }
}

// Universal ESC Key Handler + Konami Code
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let kIdx = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !inBoot) {
    if (ui.panelOpen) {
      ui.closeTop();
      return;
    }
    if (runner.active) {
      runner.exit();
      return;
    }
    audio.sfx.click();
    ui.pauseMenu(actions);
    return;
  }

  if (e.code === KONAMI[kIdx]) {
    kIdx++;
    if (kIdx === KONAMI.length) {
      kIdx = 0;
      store.state.god = !store.state.god;
      store.save();
      audio.sfx.win();
      refreshAllWorlds();
      chrome.update();
      ui.toast(store.state.god ? '⚡ GOD MODE UNLOCKED: All shards & boss active!' : 'God Mode disabled');
    }
  } else {
    kIdx = e.code === KONAMI[0] ? 1 : 0;
  }
});

// Frame loop hooks
const mouseWorld = planePoint(0);
onFrame((dt, t) => {
  if (inBoot) {
    planePoint(0, mouseWorld);
    mouseWorld.y -= 1.35;
    title.setMouseWorld(mouseWorld);
    title.update(dt, t);
  }
  fx.update(dt);
});
onBeforeRender(() => fx.applyShake());
onAfterRender(() => {
  fx.removeShake();
  endFrame();
});

startLoop();
