import * as THREE from 'three';
import gsap from 'gsap';
import { scene, camera, onFrame, onResize, globalU, visibleSize } from '../engine/renderer.js';
import { input, pick, planePoint, showKeyboard, hideKeyboard } from '../engine/input.js';
import { fx } from '../engine/fx.js';
import { audio } from '../engine/audio.js';
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
        gl_FragColor = vec4(uC * 1.6 * l * fade, l * fade * .55);
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
      <div class="m-title"><b></b><span></span></div>
      <button class="m-exit" type="button" aria-label="Exit mission">✕ EXIT</button>
    </div>
    <div class="m-timer"><i></i></div>
    <div class="m-hint"></div>
    <div class="m-banner"><span></span></div>
    <div class="m-menu" data-ui>
      <h3>MISSION FAILED</h3>
      <p>No stress. Nothing here is graded, and your future employer isn't watching the clock.</p>
      <div class="m-btns"><button type="button" data-a="retry" class="btn primary">↻ RETRY</button><button type="button" data-a="skip" class="btn">SKIP → READ THE STORY</button></div>
    </div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const titleB = q('.m-title b'), titleS = q('.m-title span');
  const timerBar = q('.m-timer i'), hintEl = q('.m-hint'), banner = q('.m-banner'), bannerS = q('.m-banner span');
  const menu = q('.m-menu');

  let resolveRun = null;
  let active = false;
  let m = null, mod = null, game = null, group = null, grid = null;
  let state = 'idle'; // intro | play | won | lost
  let left = 0, total = 0, tickSec = -1;
  let offFrame = null, accent = new THREE.Color();

  function camZ() { const a = window.innerWidth / window.innerHeight; return a >= 1.6 ? 10 : 10 * Math.min(2.4, 1.6 / a); }
  function placeCamera() { camera.fov = 50; camera.position.set(0, 0, camZ()); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); }
  onResize(() => { if (active) placeCamera(); });

  const ctx = {
    THREE, gsap, camera, fx,
    audio, input, pick, planePoint, showKeyboard,
    view: () => visibleSize(camera.position.z),
    win() { if (state !== 'play') return; endWin(); },
    lose() { if (state !== 'play') return; endLose(); },
    penalty(s) { left = Math.max(0.2, left - s); gsap.fromTo(timerBar.parentElement, { x: -4 }, { x: 0, duration: 0.3, ease: 'elastic.out(2,0.3)' }); },
    timeLeft: () => left,
    setHint(t) { hintEl.textContent = t; },
  };

  function banner_(text, color, hold = 0.9) {
    bannerS.textContent = text;
    bannerS.style.color = color;
    gsap.killTweensOf(banner);
    gsap.fromTo(banner, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.4)' });
    if (hold) gsap.to(banner, { opacity: 0, scale: 1.25, duration: 0.35, delay: hold, ease: 'power2.in' });
  }

  function buildGame() {
    group = new THREE.Group();
    scene.add(group);
    grid = makeGrid(m.color);
    group.add(grid);
    ctx.scene = group;
    ctx.accent = accent;
    ctx.time = total;
    game = mod.create(ctx);
  }
  function teardownGame() {
    try { game?.dispose?.(); } catch (e) { console.warn(e); }
    game = null;
    if (group) { scene.remove(group); disposeTree(group); group = null; }
    hideKeyboard();
  }

  function intro() {
    state = 'intro';
    menu.classList.remove('open');
    gsap.to(menu, { autoAlpha: 0, duration: 0.2 });
    left = total = m.time;
    tickSec = -1;
    timerBar.style.transform = 'scaleX(1)';
    timerBar.parentElement.classList.remove('danger');
    hintEl.textContent = m.hint;
    hintEl.style.opacity = 0;
    banner_(m.verb, m.color, 0.55);
    audio.sfx.click();
    gsap.delayedCall(0.95, () => {
      if (!active) return;
      buildGame();
      state = 'play';
      gsap.to(hintEl, { opacity: 1, duration: 0.4 });
    });
  }

  function endWin() {
    state = 'won';
    const bonus = Math.round((left / total) * 60);
    audio.sfx.win();
    fx.flash(m.color, 0.35);
    fx.ring(new THREE.Vector3(0, 0, 0), accent, 12, 1.0);
    fx.burst(new THREE.Vector3(0, 0, 1), accent, 160, 9, 0.22, 1.4, 0);
    banner_(m.boss ? 'BOSS DOWN!' : 'CLEARED!', '#3dffb5', 1.0);
    gsap.delayedCall(1.55, () => finish({ result: 'win', bonus }));
  }
  function endLose() {
    state = 'lost';
    audio.sfx.lose();
    fx.flash('#ff2d55', 0.4);
    fx.shake(0.5, 0.5);
    banner_('MISSION FAILED', '#ff5470', 0.9);
    gsap.delayedCall(1.0, () => { if (state === 'lost') { menu.classList.add('open'); gsap.fromTo(menu, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }); } });
  }

  function finish(res) {
    if (!active) return;
    active = false;
    state = 'idle';
    offFrame?.(); offFrame = null;
    gsap.killTweensOf(banner);
    gsap.set(banner, { opacity: 0 });
    gsap.to(el, { autoAlpha: 0, duration: 0.25 });
    teardownGame();
    const r = resolveRun; resolveRun = null;
    r?.(res);
  }

  q('.m-exit').addEventListener('click', () => { audio.sfx.click(); finish({ result: 'back' }); });
  menu.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    audio.sfx.click();
    if (a === 'retry') { teardownGame(); intro(); }
    if (a === 'skip') finish({ result: 'skip' });
  });

  function frame(dt, t) {
    if (!active) return;
    if (grid) grid.position.z = 0;
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
    /** Resolves { result: 'win'|'skip'|'back', bonus } */
    start(mission) {
      m = mission;
      mod = games[mission.game];
      accent = new THREE.Color(mission.color);
      active = true;
      const c1 = accent.clone().multiplyScalar(0.28);
      const c2 = accent.clone().offsetHSL(0.12, 0, -0.18).multiplyScalar(0.45);
      setNebula(c1, c2, 0.62);
      placeCamera();
      titleB.textContent = pad(m.n);
      titleS.textContent = m.title.toUpperCase();
      timerBar.style.background = `linear-gradient(90deg, ${m.color}, #ffffff)`;
      el.style.setProperty('--accent', m.color);
      gsap.set(el, { autoAlpha: 1 });
      globalU.uWarp.value = 1;
      gsap.to(globalU.uWarp, { value: 0, duration: 1.0, ease: 'power3.out' });
      streaks.material.uniforms.uTint.value.set(m.color);
      offFrame = onFrame(frame);
      intro();
      return new Promise((res) => { resolveRun = res; });
    },
  };
}
