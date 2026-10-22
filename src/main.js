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
import { createMissionRunner } from './world/mission.js';
import { ui } from './ui/ui.js';

initInput();
audio.setMuted(!!store.state.muted);

// Build 3D systems
const runner = createMissionRunner();
const hub = createHub({
  onSelect: (idx) => launchMission(idx),
  onToast: (msg) => ui.toast(msg),
});
hub.hide();

// Particle title screen in 3D
const title = createTitle(['SAKSHAM', 'SHARMA']);
title.group.position.set(0, 1.35, 0);
scene.add(title.group);

// Ensure fonts are ready before sampling or re-forming if needed
document.fonts?.ready?.then(() => {
  title.form(2.4);
});
title.form(2.4);

const actions = {
  card: () => { ui.closeAll(); ui.card(); },
  vault: () => { ui.closeAll(); ui.vault(); },
  contact: () => { ui.closeAll(); ui.contact(); },
  recruiter: () => { ui.closeAll(); ui.recruiter(); },
};

const chrome = ui.chrome(actions);
ui.onPanel(
  () => { hub.blocked = true; },
  (_entry, remaining) => { if (remaining === 0) hub.blocked = false; },
);

let inBoot = true;
const bootEl = document.getElementById('boot');

async function exitBoot(openRecruiter = false) {
  if (!inBoot) return;
  inBoot = false;
  audio.init();
  audio.sfx.boot();
  gsap.to(bootEl, { autoAlpha: 0, duration: 0.45, onComplete: () => bootEl.remove() });
  globalU.uWarp.value = 0.85;
  gsap.to(globalU.uWarp, { value: 0, duration: 1.2, ease: 'power3.out' });
  await title.explode(0.95);
  scene.remove(title.group);
  title.dispose();

  hub.show();
  hub.refresh();
  chrome.show();
  chrome.update();

  if (openRecruiter) {
    ui.recruiter();
  } else if (!store.state.intro) {
    store.state.intro = true;
    store.save();
    await ui.briefing();
  }
}

document.getElementById('boot-enter').addEventListener('click', () => exitBoot(false));
document.getElementById('boot-recruiter').addEventListener('click', () => exitBoot(true));

async function launchMission(idx) {
  const m = missions[idx];
  if (!m || runner.active) return;
  chrome.hide();
  chrome.hideHint();
  await hub.dive(idx);
  hub.hide();

  const res = await runner.start(m);
  hub.show();
  hub.settle();
  chrome.show();

  if (res.result === 'win' || res.result === 'skip') {
    const skipped = res.result === 'skip';
    const first = store.markCleared(m.id, skipped, res.bonus || 0);
    hub.refresh();
    chrome.update();
    hub.awardShards(m);
    hub.shift(-3.2, 0.8);
    await ui.reveal(m, { bonus: res.bonus || 0, skipped, first });
    hub.shift(0, 0.8);

    if (store.clearedCount() >= missions.length && first) {
      ui.finale(actions);
    }
  } else {
    hub.refresh();
    chrome.update();
  }
}

// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A -> Unlocks God Mode
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
let kIdx = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === KONAMI[kIdx]) {
    kIdx++;
    if (kIdx === KONAMI.length) {
      kIdx = 0;
      store.state.god = !store.state.god;
      store.save();
      audio.sfx.win();
      hub.refresh();
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
