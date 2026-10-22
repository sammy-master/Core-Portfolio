import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, onFrame, onResize, globalU, visibleSize } from '../engine/renderer.js';
import { input, pick, planePoint, showKeyboard, hideKeyboard } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
import { store, DIFFICULTIES } from '../engine/store.js';
import { setNebula, streaks } from './background.js';
import { games } from '../games/index.js';

const pad = (n) => String(n).padStart(2, '0');

function disposeTree(root) {
  root.traverse((o) => {
    gsap.killTweensOf(o); gsap.killTweensOf(o.position); gsap.killTweensOf(o.scale); gsap.killTweensOf(o.rotation);
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => { gsap.killTweensOf(m); if (m.map) m.map.dispose(); m.dispose(); });
    }
    if (o.geometry) o.geometry.dispose();
  });
}

function makeGrid(color) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: new THREE.Color(color) }, uTime: globalU.uTime },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP; uniform vec3 uC; uniform float uTime;
      void main(){
        vec2 p = vP * .5; p.y += uTime * .6;
        vec2 g = abs(fract(p - .5) - .5) / fwidth(p);
        float l = 1. - min(min(g.x, g.y), 1.);
        float fade = smoothstep(60., 4., length(vP));
        gl_FragColor = vec4(uC * 1.4 * l * fade, l * fade * .45);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120, 1, 1), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -5.4;
  return m;
}

export function createMissionRunner() {
  const root = document.getElementById('stage-ui');
  const el = document.createElement('div');
  el.className = 'm-ui';
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <div class="m-top" data-ui>
      <div class="m-title"><b></b><span></span><em class="m-prog"></em></div>
      <div class="m-top-r">
        <button class="m-skip-quick" type="button" title="Skip mini-game and read chapter">SKIP → STORY</button>
        <button class="m-exit" type="button" aria-label="Exit mission">✕ EXIT</button>
      </div>
    </div>
    <div class="m-timer"><i></i></div>
    <div class="m-hint"></div>
    <div class="m-banner"><span></span></div>

    <!-- Pre-Mission Tactical How-To Card -->
    <div class="m-prep glass" data-ui>
      <div class="mp-eyebrow"><span id="mp-chap">MISSION 01</span> · <span id="mp-ctrl">MOUSE / KEYBOARD</span></div>
      <h3 id="mp-title">Hello, World</h3>
      <p class="mp-sub" id="mp-hint"></p>
      <ul class="mp-steps" id="mp-steps"></ul>
      <div class="mp-diff">
        <span>DIFFICULTY:</span>
        <div class="mp-diff-btns" id="mp-diff-btns">
          <button type="button" data-d="chill">CHILL (EASY)</button>
          <button type="button" data-d="normal">NORMAL</button>
          <button type="button" data-d="pro">PRO</button>
        </div>
      </div>
      <div class="mp-rewards" id="mp-rewards"></div>
      <div class="m-btns">
        <button type="button" class="btn primary big" id="mp-go">▶ LAUNCH MISSION [SPACE]</button>
        <button type="button" class="btn" id="mp-skip">📖 SKIP → VIEW STORY & CERTS</button>
      </div>
    </div>

    <!-- Failure / Retry Card -->
    <div class="m-menu glass" data-ui>
      <h3>TIME'S UP!</h3>
      <p>Want another shot, try on <b>CHILL</b> mode (+65% time), or jump straight to the story & certificates?</p>
      <div class="m-btns">
        <button type="button" data-a="retry" class="btn primary">↻ RETRY</button>
        <button type="button" data-a="chill" class="btn">🌿 RETRY ON CHILL MODE</button>
        <button type="button" data-a="skip" class="btn">📖 SKIP → VIEW STORY & CERTS</button>
      </div>
    </div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const titleB = q('.m-title b'), titleS = q('.m-title span'), progEl = q('.m-prog');
  const timerBar = q('.m-timer i'), hintEl = q('.m-hint'), banner = q('.m-banner'), bannerS = q('.m-banner span');
  const prep = q('.m-prep'), menu = q('.m-menu');

  let resolveRun = null;
  let active = false;
  let m = null, mod = null, game = null, group = null, grid = null;
  let state = 'idle'; // prep | intro | play | won | lost
  let left = 0, total = 0, tickSec = -1;
  let offFrame = null, accent = new THREE.Color();

  function camZ() { const a = window.innerWidth / window.innerHeight; return a >= 1.6 ? 10 : 10 * Math.min(2.4, 1.6 / a); }
  function placeCamera() { camera.fov = 50; camera.position.set(0, 0, camZ()); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }
  onResize(() => { if (active) placeCamera(); });

  const ctx = {
    THREE, gsap, camera, fx,
    audio, input, pick, planePoint, showKeyboard,
    get difficulty() { return store.state.difficulty; },
    view: () => visibleSize(camera.position.z),
    win() { if (state !== 'play') return; endWin(); },
    lose() { if (state !== 'play') return; endLose(); },
    penalty(s) {
      const scaled = s * store.diff.penaltyMult;
      if (scaled <= 0) return;
      left = Math.max(0.3, left - scaled);
      gsap.fromTo(timerBar.parentElement, { x: -4 }, { x: 0, duration: 0.3, ease: 'elastic.out(2,0.3)' });
    },
    timeLeft: () => left,
    setHint(t) { hintEl.textContent = t; },
    setProgress(t) { progEl.textContent = t ? `· ${t}` : ''; },
  };

  function banner_(text, color, hold = 0.85) {
    bannerS.textContent = text;
    bannerS.style.color = color;
    gsap.killTweensOf(banner);
    gsap.fromTo(banner, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2.2)' });
    if (hold) gsap.to(banner, { opacity: 0, scale: 1.2, duration: 0.32, delay: hold, ease: 'power2.in' });
  }

  function buildGame() {
    group = new THREE.Group();
    scene.add(group);
    grid = makeGrid(m.color);
    group.add(grid);
    ctx.scene = group;
    ctx.accent = accent;
    ctx.time = total;
    progEl.textContent = '';
    game = mod.create(ctx);
  }

  function teardownGame() {
    try { game?.dispose?.(); } catch (e) { console.warn(e); }
    game = null;
    if (group) { scene.remove(group); disposeTree(group); group = null; }
    hideKeyboard();
  }

  function syncDiffUI() {
    q('#mp-diff-btns').querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.d === store.state.difficulty);
    });
    total = Math.round(m.time * store.diff.timeMult);
    left = total;
  }

  function showPrep() {
    state = 'prep';
    menu.classList.remove('open');
    gsap.set(menu, { autoAlpha: 0 });
    q('#mp-chap').textContent = `MISSION ${pad(m.n)} · ${m.year}`;
    q('#mp-ctrl').textContent = m.controls || 'MOUSE / TOUCH';
    q('#mp-title').textContent = m.title;
    q('#mp-hint').textContent = m.hint;
    q('#mp-steps').innerHTML = (m.howTo || [m.hint]).map((s, i) => `<li><b>${i + 1}</b><span>${s}</span></li>`).join('');
    const certCount = (m.certs || []).length;
    q('#mp-rewards').innerHTML = `
      <span>🏆 Unlocks: <b>${m.skills.length} Skills</b>${certCount ? ` · <b>${certCount} Certificate${certCount > 1 ? 's' : ''}</b>` : ''}${m.projects.length ? ` · <b>${m.projects.length} Live Project${m.projects.length > 1 ? 's' : ''}</b>` : ''}</span>`;
    syncDiffUI();
    hintEl.style.opacity = 0;
    timerBar.style.transform = 'scaleX(1)';
    prep.classList.add('open');
    gsap.fromTo(prep, { autoAlpha: 0, y: 24, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' });
  }

  function startGameplay() {
    if (state !== 'prep' && state !== 'lost') return;
    prep.classList.remove('open');
    gsap.to(prep, { autoAlpha: 0, duration: 0.2 });
    menu.classList.remove('open');
    gsap.to(menu, { autoAlpha: 0, duration: 0.2 });
    state = 'intro';
    total = Math.round(m.time * store.diff.timeMult);
    left = total;
    tickSec = -1;
    timerBar.style.transform = 'scaleX(1)';
    timerBar.parentElement.classList.remove('danger');
    hintEl.textContent = m.hint;
    hintEl.style.opacity = 0;
    banner_(m.verb, m.color, 0.45);
    audio.sfx.click();
    gsap.delayedCall(0.7, () => {
      if (!active) return;
      buildGame();
      state = 'play';
      gsap.to(hintEl, { opacity: 1, duration: 0.35 });
    });
  }

  function endWin() {
    state = 'won';
    const bonus = Math.round((left / total) * 60);
    audio.sfx.win();
    fx.flash(m.color, 0.14);
    fx.ring(new THREE.Vector3(0, 0, 0), accent, 10, 0.9);
    fx.burst(new THREE.Vector3(0, 0, 1), accent, 120, 8, 0.2, 1.2, 0);
    banner_(m.boss ? 'BOSS CLEARED!' : 'MISSION CLEARED!', '#3dffb5', 0.95);
    gsap.delayedCall(1.35, () => finish({ result: 'win', bonus }));
  }

  function endLose() {
    state = 'lost';
    audio.sfx.lose();
    fx.flash('#ff2d55', 0.14);
    fx.shake(0.35, 0.4);
    banner_('TIME UP', '#ff5470', 0.75);
    gsap.delayedCall(0.85, () => {
      if (state === 'lost') {
        menu.classList.add('open');
        gsap.fromTo(menu, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' });
      }
    });
  }

  function finish(res) {
    if (!active) return;
    active = false;
    state = 'idle';
    offFrame?.(); offFrame = null;
    prep.classList.remove('open');
    menu.classList.remove('open');
    gsap.killTweensOf(banner);
    gsap.set(banner, { opacity: 0 });
    gsap.to(el, { autoAlpha: 0, duration: 0.25 });
    teardownGame();
    const r = resolveRun; resolveRun = null;
    r?.(res);
  }

  q('.m-exit').addEventListener('click', () => { audio.sfx.click(); finish({ result: 'back' }); });
  q('.m-skip-quick').addEventListener('click', () => { audio.sfx.click(); finish({ result: 'skip' }); });
  q('#mp-go').addEventListener('click', () => startGameplay());
  q('#mp-skip').addEventListener('click', () => { audio.sfx.click(); finish({ result: 'skip' }); });
  q('#mp-diff-btns').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.sfx.click();
    store.setDifficulty(b.dataset.d);
    syncDiffUI();
  });

  menu.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    audio.sfx.click();
    if (a === 'retry') { teardownGame(); startGameplay(); }
    if (a === 'chill') { store.setDifficulty('chill'); teardownGame(); startGameplay(); }
    if (a === 'skip') finish({ result: 'skip' });
  });

  function frame(dt, t) {
    if (!active) return;
    if (state === 'prep') {
      if (input.keysPressed.has('Space') || input.keysPressed.has('Enter')) startGameplay();
      return;
    }
    if (state === 'play') {
      left -= dt;
      const secs = Math.ceil(left);
      if (left <= 3.2 && secs !== tickSec && left > 0) { tickSec = secs; audio.sfx.tick(); }
      timerBar.style.transform = `scaleX(${Math.max(0, left / total)})`;
      timerBar.parentElement.classList.toggle('danger', left / total < 0.28);
      try { game.update(dt, t); } catch (e) { console.error('[game]', e); }
      if (state === 'play' && left <= 0) { if (mod.timeoutWins) endWin(); else endLose(); }
    } else if (state === 'won' || state === 'lost') {
      try { game?.update?.(dt, t); } catch { /* ignore */ }
    }
  }

  return {
    get active() { return active; },
    start(mission) {
      m = mission;
      mod = games[mission.game];
      accent = new THREE.Color(mission.color);
      active = true;
      const c1 = accent.clone().multiplyScalar(0.22);
      const c2 = accent.clone().offsetHSL(0.12, 0, -0.18).multiplyScalar(0.38);
      setNebula(c1, c2, 0.52);
      placeCamera();
      titleB.textContent = pad(m.n);
      titleS.textContent = m.title.toUpperCase();
      progEl.textContent = '';
      timerBar.style.background = `linear-gradient(90deg, ${m.color}, #ffffff)`;
      el.style.setProperty('--accent', m.color);
      gsap.set(el, { autoAlpha: 1 });
      globalU.uWarp.value = 0.85;
      gsap.to(globalU.uWarp, { value: 0, duration: 0.9, ease: 'power3.out' });
      streaks.material.uniforms.uTint.value.set(m.color);
      offFrame = onFrame(frame);
      showPrep();
      return new Promise((res) => { resolveRun = res; });
    },
  };
}
