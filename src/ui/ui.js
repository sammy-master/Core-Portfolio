import gsap from 'gsap';
import { profile, timeline, categories, missions, projects, certs, blogs } from '../data/content.js';
import { store, DIFFICULTIES } from '../engine/store.js';
import { audio } from '../engine/audio.js';

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const RANKS = ['Rookie', 'Apprentice', 'Builder', 'Engineer', 'Architect', 'Legend'];
const rankOf = (lv) => RANKS[Math.min(RANKS.length - 1, lv - 1)];
const levelName = (v) => (v >= 85 ? 'STRONG' : v >= 70 ? 'PROFICIENT' : v >= 50 ? 'FAMILIAR' : 'LEARNING');

const panelRoot = () => $('#panel-root');
let panelHandlers = { open: () => {}, close: () => {} };
let globalActions = null;
const stack = [];

function mount(html, cls = '', { side = false, closable = true, backLabel = '← BACK TO WORLD [ESC]' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap' + (side ? ' side' : '');
  wrap.setAttribute('data-ui', '');
  const navBar = closable ? `
    <div class="p-nav">
      <button class="p-back" type="button" aria-label="Go back">${backLabel}</button>
      <button class="p-close" type="button" aria-label="Close">✕</button>
    </div>` : '';
  wrap.innerHTML = `<div class="panel glass ${cls}" role="dialog" aria-modal="${!side}">${navBar}<div class="p-content">${html}</div></div>`;
  panelRoot().appendChild(wrap);
  const panel = $('.panel', wrap);
  const entry = { wrap, panel, close };
  stack.push(entry);
  panelHandlers.open(entry);
  gsap.fromTo(wrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.22 });
  gsap.fromTo(panel, { y: side ? 0 : 28, x: side ? 56 : 0, scale: 0.97, opacity: 0 }, { y: 0, x: 0, scale: 1, opacity: 1, duration: 0.42, ease: 'expo.out' });
  if (closable) {
    $('.p-close', wrap)?.addEventListener('click', () => { audio.sfx.click(); close(); });
    $('.p-back', wrap)?.addEventListener('click', () => { audio.sfx.click(); close(); });
  }
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && closable) { audio.sfx.click(); close(); } });
  function close() {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    gsap.to(panel, { y: 18, opacity: 0, scale: 0.97, duration: 0.18, ease: 'power2.in' });
    gsap.to(wrap, { autoAlpha: 0, duration: 0.22, onComplete: () => { wrap.remove(); panelHandlers.close(entry, stack.length); } });
    entry.onClose?.();
  }
  return entry;
}

export const ui = {
  onPanel(open, close) { panelHandlers = { open, close }; },
  get panelOpen() { return stack.length > 0; },
  closeTop() {
    if (!stack.length) return false;
    const top = stack[stack.length - 1];
    audio.sfx.click();
    top.close();
    return true;
  },
  closeAll() { [...stack].forEach((e) => e.close()); },

  // ---------- Chrome (Top HUD + Mode Switcher + ESC Menu + Bottom Dock) ----------
  chrome(actions) {
    globalActions = actions;
    const top = document.createElement('header');
    top.className = 'topbar';
    top.setAttribute('data-ui', '');
    top.innerHTML = `
      <button class="esc-btn" id="btn-esc-menu" type="button" title="Open Navigation & Pause Menu [ESC]">
        <i>☰</i><span>MENU [ESC]</span>
      </button>

      <div class="brand" id="brand-home" title="About Saksham Sharma">
        <img src="${profile.avatar}" alt="Saksham" class="brand-av" />
        <div class="brand-txt"><span class="logo">SAKSHAM</span><span class="brand-t">B.TECH CSE · PCU</span></div>
      </div>

      <div class="mode-switch" role="tablist" aria-label="3D World Mode">
        <button type="button" data-mode="orrery" class="active" title="Solar System Mission Orrery"><i>🌌</i><span>SOLAR CORE</span></button>
        <button type="button" data-mode="drive" title="Forza Horizon 3D Drive Circuit"><i>🏎️</i><span>FORZA DRIVE</span></button>
        <button type="button" data-mode="shooter" title="Valorant / CS2 Tactical Aim Range"><i>🎯</i><span>FPS RANGE</span></button>
      </div>

      <button class="diff-pill" id="btn-diff" type="button" title="Cycle game difficulty (Chill / Normal / Pro)">
        <span>DIFFICULTY:</span> <b id="diff-lbl">NORMAL</b>
      </button>

      <div class="lv" title="Player Level & XP">
        <div class="lv-n">LV <b id="lv-n">1</b></div>
        <div class="lv-r"><span id="lv-rank">Rookie</span><div class="xp"><i id="xp-bar"></i></div></div>
      </div>

      <div class="clear-c" aria-label="Missions cleared">
        <b id="cl-n">0</b><span>/${missions.length}</span><em>CLEARED</em>
      </div>

      <button class="icon-btn" id="btn-sound" type="button" aria-label="Toggle sound">🔊</button>`;

    const dock = document.createElement('nav');
    dock.className = 'dock';
    dock.setAttribute('data-ui', '');
    dock.setAttribute('aria-label', 'Portfolio Navigation');
    dock.innerHTML = `
      <button type="button" data-a="card"><i>◈</i><span>About & Skills</span></button>
      <button type="button" data-a="vault"><i>▣</i><span>Projects (${projects.length})</span></button>
      <button type="button" data-a="certs"><i>🏆</i><span>Certificates (${certs.length})</span></button>
      <button type="button" data-a="blogs"><i>✍️</i><span>Stories & Blogs</span></button>
      <button type="button" data-a="contact"><i>✦</i><span>Contact</span></button>
      <button type="button" data-a="recruiter" class="alt"><i>⚡</i><span>Recruiter Dossier</span></button>`;

    const hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.id = 'world-hint';
    hint.innerHTML = '<span>DRAG TO ROTATE</span><i></i><span>SCROLL TO ZOOM</span><i></i><span>CLICK ANY PLANET OR ORBIT PILL TO PLAY</span>';

    const ui_ = $('#ui');
    ui_.append(top, dock, hint);

    top.querySelector('#btn-esc-menu').addEventListener('click', () => {
      audio.sfx.click();
      if (stack.length) ui.closeAll();
      else ui.pauseMenu(actions);
    });

    dock.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.sfx.click(); actions[b.dataset.a]?.();
    });
    top.querySelector('#brand-home').addEventListener('click', () => {
      audio.sfx.click(); actions.card?.();
    });

    const modeSwitch = top.querySelector('.mode-switch');
    modeSwitch.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.sfx.click();
      actions.setMode?.(b.dataset.mode);
    });

    const diffBtn = top.querySelector('#btn-diff');
    const diffOrder = ['chill', 'normal', 'pro'];
    diffBtn.addEventListener('click', () => {
      audio.sfx.click();
      const next = diffOrder[(diffOrder.indexOf(store.state.difficulty) + 1) % diffOrder.length];
      store.setDifficulty(next);
      sync();
      ui.toast(`Difficulty: ${DIFFICULTIES[next].label} — ${DIFFICULTIES[next].desc}`);
    });

    const sb = $('#btn-sound');
    const syncSound = (m) => { sb.textContent = m ? '🔇' : '🔊'; sb.setAttribute('aria-pressed', String(m)); };
    syncSound(audio.muted);
    audio.onMute(syncSound);
    sb.addEventListener('click', () => { audio.toggle(); store.state.muted = audio.muted; store.save(); });

    gsap.set([top, dock, hint], { autoAlpha: 0 });

    function sync() {
      const lv = store.level;
      $('#lv-n').textContent = lv;
      $('#lv-rank').textContent = rankOf(lv);
      gsap.to('#xp-bar', { scaleX: store.levelProgress, duration: 0.6, ease: 'power3.out' });
      const n = store.state.god ? missions.length : store.clearedCount();
      $('#cl-n').textContent = n;
      $('#diff-lbl').textContent = store.diff.label;
      modeSwitch.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === store.state.worldMode);
      });
      if (store.state.worldMode === 'orrery') {
        hint.innerHTML = '<span>DRAG TO ROTATE</span><i></i><span>SCROLL TO ZOOM</span><i></i><span>CLICK ANY PLANET OR SOLAR PILL BELOW</span>';
      } else if (store.state.worldMode === 'drive') {
        hint.innerHTML = '<span>WASD / ARROWS TO DRIVE</span><i></i><span>SPACE DRIFT · [H] SHOCKWAVE</span><i></i><span>CLICK TOP GPS PILLS TO TELEPORT</span>';
      } else {
        hint.innerHTML = '<span>AIM & CLICK TO SHOOT TARGETS</span><i></i><span>[1][2][3] SWITCH WEAPONS</span><i></i><span>[E] PLAY MISSION · [F] VIEW STORY</span>';
      }
    }

    return {
      show() { sync(); gsap.to([top, dock, hint], { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }); },
      hide() { gsap.to([top, dock, hint], { autoAlpha: 0, duration: 0.22 }); },
      hideHint() { gsap.to(hint, { autoAlpha: 0, duration: 0.3 }); },
      update: sync,
    };
  },

  toast(msg, ms = 3800) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.textContent = msg;
    box.appendChild(t);
    gsap.fromTo(t, { y: 20, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)' });
    gsap.to(t, { opacity: 0, y: -10, duration: 0.3, delay: ms / 1000, onComplete: () => t.remove() });
  },

  // ---------- ESC Pause & Quick Command Menu ----------
  pauseMenu(actions = globalActions) {
    const curMode = store.state.worldMode || 'orrery';
    const curDiff = store.state.difficulty || 'normal';
    const e = mount(`
      <div class="eyebrow">COMMAND CENTER & PAUSE MENU · PRESS [ESC] ANYTIME</div>
      <h2>Quick Navigation & World Controls</h2>
      <p class="sub">Jump straight to any 3D mode, portfolio section, or mission chapter.</p>

      <div class="pm-section">
        <h4>1. Switch 3D Interactive Mode</h4>
        <div class="mode-cards">
          <button type="button" class="mcard ${curMode === 'orrery' ? 'active' : ''}" data-m="orrery">
            <b>🌌 Solar Core Orrery</b>
            <span>Orbit the 10-planet solar system & dive into 5–12s micro-missions.</span>
          </button>
          <button type="button" class="mcard ${curMode === 'drive' ? 'active' : ''}" data-m="drive">
            <b>🏎️ Forza Horizon Drive</b>
            <span>Drive the cyber-supercar, hit nitro boost pads, blast crates & visit project pit-stops.</span>
          </button>
          <button type="button" class="mcard ${curMode === 'shooter' ? 'active' : ''}" data-m="shooter">
            <b>🎯 Tactical FPS Range</b>
            <span>Valorant / CS2 aim lab — switch weapons & snipe target bots to unlock chapters.</span>
          </button>
        </div>
      </div>

      <div class="pm-section">
        <h4>2. Open Portfolio Dossiers</h4>
        <div class="pm-nav-grid">
          <button type="button" class="btn primary" data-nav="recruiter">⚡ Executive Recruiter Dossier</button>
          <button type="button" class="btn" data-nav="card">🪪 About Me, Personality & Skills</button>
          <button type="button" class="btn" data-nav="vault">🚀 Shipped Projects (${projects.length})</button>
          <button type="button" class="btn" data-nav="certs">🏆 Verified Certificates (${certs.length})</button>
          <button type="button" class="btn" data-nav="blogs">✍️ Honest Stories & Blogs (${blogs.length})</button>
          <button type="button" class="btn" data-nav="contact">✉ Contact & Links</button>
        </div>
      </div>

      <div class="pm-section">
        <h4>3. Direct Mission Launcher (Play Mini-Game or Read Story & Certs)</h4>
        <div class="pm-missions">
          ${missions.map((m, idx) => `
            <div class="pm-mcard" style="--c:${m.color}">
              <div class="pm-mhead">
                <b>${pad(m.n)}</b>
                <span>${m.title}</span>
                <em>${store.isCleared(m.id) ? '✓ CLEARED' : m.year}</em>
              </div>
              <div class="pm-mbtns">
                <button type="button" class="btn primary small" data-play="${idx}">▶ Play</button>
                <button type="button" class="btn small" data-read="${idx}">📖 Story & Certs</button>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="pm-section pm-settings">
        <div class="pm-diff-row">
          <span>DIFFICULTY:</span>
          <button type="button" class="f-btn ${curDiff === 'chill' ? 'active' : ''}" data-diff="chill">🌿 CHILL (EASY)</button>
          <button type="button" class="f-btn ${curDiff === 'normal' ? 'active' : ''}" data-diff="normal">⚡ NORMAL</button>
          <button type="button" class="f-btn ${curDiff === 'pro' ? 'active' : ''}" data-diff="pro">🔥 PRO</button>
        </div>
        <div class="pm-diff-row">
          <a class="btn small" href="${profile.resume}" target="_blank" rel="noopener">📄 Résumé PDF ↗</a>
          <button type="button" class="btn small" id="pm-god">⚡ ${store.state.god ? 'Disable' : 'Enable'} God Mode (Unlock All)</button>
        </div>
      </div>`, 'pause-modal wide', { backLabel: '▶ RESUME WORLD [ESC]' });

    e.panel.querySelectorAll('.mcard').forEach((card) => {
      card.addEventListener('click', () => {
        audio.sfx.click();
        e.close();
        actions?.setMode?.(card.dataset.m);
      });
    });

    e.panel.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        audio.sfx.click();
        e.close();
        actions?.[nav]?.();
      });
    });

    e.panel.querySelectorAll('[data-play]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.play);
        audio.sfx.click();
        e.close();
        actions?.playMission?.(idx);
      });
    });

    e.panel.querySelectorAll('[data-read]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.read);
        audio.sfx.click();
        e.close();
        actions?.inspectMission?.(missions[idx]);
      });
    });

    e.panel.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const d = btn.dataset.diff;
        audio.sfx.click();
        store.setDifficulty(d);
        e.panel.querySelectorAll('[data-diff]').forEach((b) => b.classList.toggle('active', b.dataset.diff === d));
        ui.toast(`Difficulty set to ${DIFFICULTIES[d].label}`);
      });
    });

    $('#pm-god', e.panel)?.addEventListener('click', () => {
      store.state.god = !store.state.god;
      store.save();
      audio.sfx.win();
      e.close();
      ui.toast(store.state.god ? '⚡ God Mode Activated: All chapters unlocked!' : 'God Mode disabled');
    });

    return e;
  },

  // ---------- Mission Briefing ----------
  briefing(actions = globalActions) {
    return new Promise((resolve) => {
      const e = mount(`
        <div class="brief-hero">
          <img src="${profile.avatar}" alt="${profile.name}" class="brief-av" />
          <div>
            <div class="eyebrow">WELCOME TO SAKSHAM'S INTERACTIVE WORLD</div>
            <h2>Hey, I'm <span class="grad">Saksham Sharma</span>.</h2>
            <p class="lead">${profile.tagline}</p>
          </div>
        </div>
        <p class="brief-bio">${profile.bio}</p>
        <div class="mode-cards">
          <button type="button" class="mcard active" data-m="orrery">
            <b>🌌 Solar Core Orrery</b>
            <span>Rotate the 10-planet solar system & dive into 5–12s micro-missions.</span>
          </button>
          <button type="button" class="mcard" data-m="drive">
            <b>🏎️ Forza Horizon Drive</b>
            <span>Drive a cyber-supercar with live KM/H telemetry, nitro pads & project pit-stops!</span>
          </button>
          <button type="button" class="mcard" data-m="shooter">
            <b>🎯 Tactical FPS Range</b>
            <span>CS2 / Valorant firing range — snipe mission target bots to unlock chapters!</span>
          </button>
        </div>
        <div class="p-actions">
          <button class="btn primary big" type="button" id="brief-go">▶ START EXPLORING</button>
          <button class="btn big" type="button" id="brief-recruiter">⚡ OPEN RECRUITER DOSSIER</button>
        </div>`, 'brief wide', { closable: true, backLabel: '▶ ENTER 3D WORLD' });

      e.panel.querySelectorAll('.mcard').forEach((card) => {
        card.addEventListener('click', () => {
          audio.sfx.click();
          e.panel.querySelectorAll('.mcard').forEach((c) => c.classList.remove('active'));
          card.classList.add('active');
          actions?.setMode?.(card.dataset.m);
        });
      });
      $('#brief-go', e.panel).addEventListener('click', () => { audio.sfx.click(); e.close(); resolve(); });
      $('#brief-recruiter', e.panel).addEventListener('click', () => {
        audio.sfx.click(); e.close(); resolve(); setTimeout(() => ui.recruiter(actions), 220);
      });
      e.onClose = () => resolve();
    });
  },

  // ---------- After-Mission Story + Skills + Certificates + Projects Reveal ----------
  reveal(m, { bonus = 0, skipped = false, first = true } = {}) {
    return new Promise((resolve) => {
      const skillsHtml = m.skills.map((s) => `
        <div class="skill" style="--c:${m.color}">
          <div class="sk-h"><span>${s.name}</span><em>${levelName(s.lvl)} · ${s.lvl}%</em></div>
          <div class="sk-bar"><i data-w="${s.lvl}"></i></div>
        </div>`).join('');

      const certsHtml = (m.certs && m.certs.length) ? `
        <div class="rv-sec">
          <div class="unlock"><span class="tag" style="--c:${m.color}">🏆 CERTIFICATES EARNED IN THIS CHAPTER (${m.certs.length})</span></div>
          <div class="rv-certs">
            ${m.certs.map((c) => `
              <a class="rv-cert" href="${c.pdf}" target="_blank" rel="noopener" title="Click to open official PDF certificate in new tab">
                <div class="rvc-thumb"><img src="${c.thumb}" alt="${c.title}" loading="lazy" /></div>
                <div class="rvc-txt">
                  <b>${c.title}</b>
                  <span>${c.issuer}</span>
                  <em>📄 Open PDF ↗</em>
                </div>
              </a>`).join('')}
          </div>
        </div>` : '';

      const projsHtml = m.projects.length ? `
        <div class="rv-sec">
          <div class="unlock"><span class="tag" style="--c:${m.color}">🚀 PROJECTS BUILT WITH THESE SKILLS</span></div>
          <div class="rv-projs">
            ${m.projects.map((p) => `
              <div class="proj-pill">
                <b>${p.name}</b>
                <div class="pp-links">
                  ${p.demo ? `<a class="chip live" href="${p.demo}" target="_blank" rel="noopener">● Live Demo ↗</a>` : ''}
                  <a class="chip" href="${p.url}" target="_blank" rel="noopener">GitHub Repo ↗</a>
                </div>
              </div>`).join('')}
          </div>
        </div>` : '';

      const e = mount(`
        <div class="rv-num" style="--c:${m.color}">${pad(m.n)}</div>
        <div class="eyebrow" style="color:${m.color}">CHAPTER ${pad(m.n)} · ${m.year}${skipped ? ' · STORY UNLOCKED' : ' · MISSION CLEARED'}</div>
        <h2>${m.title}</h2>
        <p class="story" id="rv-story">${m.story}</p>

        <div class="unlock">
          <span class="tag" style="--c:${m.color}">⚡ SKILLS MASTERED</span>
          ${first && !skipped ? `<span class="xp-chip">+${Math.round((130 + bonus) * store.diff.xpMult)} XP</span>` : ''}
        </div>
        <div class="skills">${skillsHtml}</div>

        ${certsHtml}
        ${projsHtml}

        <div class="p-actions">
          <button class="btn primary big" type="button" id="rv-go">CONTINUE JOURNEY ▸</button>
        </div>`, 'reveal reveal-wide', { side: true, closable: true, backLabel: '← BACK TO WORLD' });

      const bars = e.panel.querySelectorAll('.sk-bar i');
      bars.forEach((b, i) => gsap.fromTo(b, { scaleX: 0 }, { scaleX: Number(b.dataset.w) / 100, duration: 0.85, delay: 0.2 + i * 0.12, ease: 'expo.out', onStart: () => audio.sfx.coin() }));
      $('#rv-go', e.panel).addEventListener('click', () => { audio.sfx.click(); e.close(); resolve(); });
      e.onClose = () => resolve();
    });
  },

  // ---------- About Me, Personality, Hobbies & Skill Radar (Player Card) ----------
  card() {
    const cats = categories.map((c) => {
      const all = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id).map((s) => ({ ...s, m })));
      const potential = all.length ? all.reduce((a, s) => a + s.lvl, 0) / all.length : 0;
      return { ...c, all, potential };
    });
    const R = 110, cx = 160, cy = 145;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / cats.length;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];
    const ring = (f) => cats.map((_, i) => pt(i, 100 * f).join(',')).join(' ');
    const axes = cats.map((c, i) => {
      const [x, y] = pt(i, 100);
      const [lx, ly] = pt(i, 122);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${c.label}</text>`;
    }).join('');
    const poly = (k) => cats.map((c, i) => pt(i, c[k]).join(',')).join(' ');
    const lv = store.level;

    const e = mount(`
      <div class="eyebrow">PLAYER PROFILE · ABOUT ME, PERSONALITY, HOBBIES & SKILLS</div>
      <div class="pc-hero">
        <img src="${profile.avatar}" alt="${profile.name}" class="pc-av" />
        <div class="pc-hero-info">
          <div class="rank">
            <span class="badge">LV ${lv} · ${rankOf(lv)}</span>
            <span class="rd-pill avail">● ${profile.status}</span>
            <span class="rd-pill">📍 ${profile.school} (${profile.batch})</span>
          </div>
          <h2>${profile.name}</h2>
          <p class="pc-bio">${profile.bio}</p>
          <div class="p-actions" style="margin-top:0.75rem">
            <a class="btn primary small" href="${profile.resume}" target="_blank" rel="noopener">📄 Open Résumé PDF ↗</a>
            <a class="btn small" href="${profile.github}" target="_blank" rel="noopener">GitHub (@sammy-master) ↗</a>
            <a class="btn small" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
            <button class="btn small" type="button" id="unlock-all-btn">⚡ Unlock All 10 Chapters</button>
          </div>
        </div>
      </div>

      <div class="card-grid">
        <div class="card-l">
          <div class="cat">
            <h4>6-Axis Skill Radar</h4>
            <svg class="radar" viewBox="0 0 320 290" role="img" aria-label="Skill radar chart">
              <g class="rings">${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}"/>`).join('')}</g>
              <g class="axes">${axes}</g>
              <polygon class="potential" points="${poly('potential')}"/>
              <polygon class="value" id="radar-v" points="${cats.map((_, i) => pt(i, 0).join(',')).join(' ')}"/>
            </svg>
          </div>

          <div class="cat" style="margin-top:1rem">
            <h4>Education & Milestones</h4>
            <div class="timeline-list">
              ${timeline.map((t) => `
                <div class="tl-item">
                  <span class="tl-yr">${t.year}</span>
                  <div class="tl-body">
                    <b>${t.title}</b>
                    <p>${t.subtitle}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>

        <div class="card-r">
          <div class="cat">
            <h4>How I Think & Work (Personality)</h4>
            <div class="pers-grid">
              ${profile.personality.map((p) => `
                <div class="pers-card">
                  <b>${p.icon} ${p.title}</b>
                  <p>${p.text}</p>
                </div>`).join('')}
            </div>
          </div>

          <div class="cat">
            <h4>Hobbies & Passions Outside Class</h4>
            <div class="hobby-chips">
              ${profile.hobbies.map((h) => `<span class="h-chip"><b>${h.tag}</b> ${h.name}</span>`).join('')}
            </div>
          </div>

          <div class="cat">
            <h4>Complete Technical Skill Matrix</h4>
            <div class="skill-cats-grid">
              ${cats.map((c) => `
                <div class="sc-box">
                  <h5 style="color:${c.color}">${c.label}</h5>
                  <div class="cat-skills">
                    ${c.all.map((s) => `
                      <div class="sk" style="--c:${s.m.color}">
                        <span>${s.name}</span><b>${s.lvl}%</b>
                        <div class="sk-bar"><i style="transform:scaleX(${s.lvl / 100})"></i></div>
                      </div>`).join('')}
                  </div>
                </div>`).join('')}
            </div>
          </div>
        </div>
      </div>`, 'card wide');

    const v = { t: 0 };
    gsap.to(v, {
      t: 1, duration: 1.0, delay: 0.15, ease: 'expo.out',
      onUpdate: () => { $('#radar-v', e.panel)?.setAttribute('points', cats.map((c, i) => pt(i, c.potential * v.t).join(',')).join(' ')); },
    });
    $('#unlock-all-btn', e.panel).addEventListener('click', () => {
      store.state.god = true;
      missions.forEach((m) => store.markCleared(m.id, false, 40));
      store.save();
      audio.sfx.win();
      ui.toast('⚡ All 10 chapters & skills unlocked!');
    });
    return e;
  },

  // ---------- Project Vault (All 16 Projects with Live Demo + GitHub Links) ----------
  vault() {
    const e = mount(`
      <div class="eyebrow">PROJECT VAULT · ${projects.length} REPOSITORIES & LIVE DEPLOYMENTS</div>
      <h2>Things I've Built & Shipped</h2>
      <p class="sub">Every project opens directly in a new tab — test the <b>Live Vercel Demos</b> or inspect the <b>GitHub Source Code</b>.</p>
      <div class="vault-grid">
        ${projects.map((p, i) => `
          <div class="vcard" style="--c:${p.color};--i:${i}">
            <div class="v-glare"></div>
            <div class="v-in">
              <span class="v-tag">${p.tag}</span>
              <h3>${p.name}</h3>
              <p>${p.blurb}</p>
              <div class="v-links">
                ${p.demo ? `<a class="btn primary small" href="${p.demo}" target="_blank" rel="noopener">● Live Demo ↗</a>` : ''}
                <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub Repo ↗</a>
              </div>
            </div>
          </div>`).join('')}
      </div>`, 'vault wide');

    const cards = e.panel.querySelectorAll('.vcard');
    cards.forEach((c) => {
      c.addEventListener('pointermove', (ev) => {
        const r = c.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
        c.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    return e;
  },

  // ---------- Visual Certificate Gallery (All 37+ Real Certificates with Thumbnails & PDFs) ----------
  certs() {
    const catList = ['All', 'Flagship', 'Cybersecurity', 'Linux & OS', 'Web & Software', 'Languages', 'Professional'];
    const e = mount(`
      <div class="eyebrow">CREDENTIALS & TROPHY ROOM · ${certs.length} VERIFIED CERTIFICATES</div>
      <h2>Certifications, Hackathons & Internships</h2>
      <p class="sub">Click any certificate card or its button to open the official high-resolution PDF in a new tab.</p>
      <div class="filter-bar" id="cert-filters">
        ${catList.map((c, i) => {
          const count = c === 'All' ? certs.length : certs.filter((x) => x.cat === c).length;
          return `<button type="button" class="f-btn ${i === 0 ? 'active' : ''}" data-c="${c}">${c} (${count})</button>`;
        }).join('')}
      </div>
      <div class="cert-gallery" id="cert-grid"></div>`, 'certs-modal wide');

    const grid = $('#cert-grid', e.panel);
    function render(filter) {
      const list = filter === 'All' ? certs : certs.filter((c) => c.cat === filter);
      grid.innerHTML = list.map((c) => `
        <a class="cg-card ${c.hot ? 'hot' : ''}" href="${c.pdf}" target="_blank" rel="noopener">
          <div class="cg-img">
            <img src="${c.thumb}" alt="${c.title}" loading="lazy" />
            ${c.hot ? '<span class="cg-hot-badge">★ FEATURED</span>' : ''}
          </div>
          <div class="cg-body">
            <span class="cg-cat">${c.cat}</span>
            <h4>${c.title}</h4>
            <p>${c.issuer}</p>
            <span class="cg-open">📄 Open Verified PDF ↗</span>
          </div>
        </a>`).join('');
    }
    render('All');

    $('#cert-filters', e.panel).addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      audio.sfx.click();
      e.panel.querySelectorAll('.f-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      render(b.dataset.c);
    });
    return e;
  },

  // ---------- Stories & Personal Blogs ----------
  blogs() {
    const e = mount(`
      <div class="eyebrow">FIELD NOTES & STORIES · WRITTEN BY SAKSHAM</div>
      <h2>Honest Stories, Lessons & Dev Logs</h2>
      <p class="sub">No AI fluff — real thoughts on C++ segfaults at 11pm, interning at Bosch, Discord bots, and college life.</p>
      <div class="blog-layout">
        <div class="blog-list" id="blog-list">
          ${blogs.map((b, i) => `
            <button type="button" class="blog-item ${i === 0 ? 'active' : ''}" data-id="${b.id}">
              <span class="bi-tag">${b.tag} · ${b.readTime}</span>
              <h4>${b.title}</h4>
              <p>${b.excerpt}</p>
            </button>`).join('')}
        </div>
        <article class="blog-reader" id="blog-reader"></article>
      </div>`, 'blogs-modal wide');

    const reader = $('#blog-reader', e.panel);
    function showBlog(id) {
      const idx = blogs.findIndex((x) => x.id === Number(id));
      const b = blogs[idx >= 0 ? idx : 0];
      const prev = blogs[(idx - 1 + blogs.length) % blogs.length];
      const next = blogs[(idx + 1) % blogs.length];
      reader.innerHTML = `
        <div class="br-meta"><span class="br-tag-pill">${b.tag}</span><span>${b.date}</span><span>·</span><span>${b.readTime}</span></div>
        <h3>${b.title}</h3>
        <div class="br-body">${b.paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>
        <div class="br-nav">
          <button type="button" class="btn small" data-goto="${prev.id}">← Prev: ${prev.title.slice(0, 26)}…</button>
          <button type="button" class="btn primary small" data-goto="${next.id}">Next: ${next.title.slice(0, 26)}… →</button>
        </div>`;
      reader.scrollTop = 0;
      reader.querySelectorAll('[data-goto]').forEach((btn) => {
        btn.addEventListener('click', () => {
          audio.sfx.click();
          const tid = btn.dataset.goto;
          e.panel.querySelectorAll('.blog-item').forEach((x) => x.classList.toggle('active', x.dataset.id === tid));
          showBlog(tid);
        });
      });
    }
    showBlog(blogs[0].id);

    $('#blog-list', e.panel).addEventListener('click', (ev) => {
      const btn = ev.target.closest('.blog-item'); if (!btn) return;
      audio.sfx.click();
      e.panel.querySelectorAll('.blog-item').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      showBlog(btn.dataset.id);
    });
    return e;
  },

  // ---------- Contact ----------
  contact() {
    const e = mount(`
      <div class="eyebrow">OPEN CHANNEL · PUNE, INDIA</div>
      <h2>Let's build <span class="grad">something great</span>.</h2>
      <p class="lead">${profile.status} — software engineering internships, full-stack builds, AI/ML research, and hackathon teams.</p>
      <div class="contact-grid">
        <a class="c-btn primary" href="mailto:${profile.email}"><i>✉</i><span><b>Email Me Directly</b>${profile.email}</span></a>
        <button class="c-btn" type="button" id="copy-mail"><i>⧉</i><span><b>Copy Email Address</b>One click to clipboard</span></button>
        <a class="c-btn" href="${profile.linkedin}" target="_blank" rel="noopener"><i>in</i><span><b>LinkedIn Profile</b>saksham-sharma-14sept ↗</span></a>
        <a class="c-btn" href="${profile.github}" target="_blank" rel="noopener"><i>⌥</i><span><b>GitHub (@sammy-master)</b>16+ repositories ↗</span></a>
        <a class="c-btn" href="${profile.resume}" target="_blank" rel="noopener"><i>📄</i><span><b>View / Download Résumé</b>Official PDF ↗</span></a>
      </div>`, 'contact');
    $('#copy-mail', e.panel).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(profile.email); ui.toast('Email copied to clipboard ✓'); audio.sfx.coin(); }
      catch { ui.toast(profile.email); }
    });
    return e;
  },

  // ---------- Executive Recruiter Dossier (Clean Tabbed Executive Dashboard) ----------
  recruiter(actions = globalActions) {
    const e = mount(`
      <div class="rec-dossier">
        <!-- Executive Hero Banner -->
        <div class="rd-hero">
          <img src="${profile.avatar}" alt="${profile.name}" class="rd-avatar" />
          <div class="rd-hero-main">
            <div class="rd-badges">
              <span class="rd-pill avail">● ${profile.status}</span>
              <span class="rd-pill">${profile.school} (${profile.batch})</span>
              <span class="rd-pill">📍 ${profile.location}</span>
            </div>
            <h2>${profile.name}</h2>
            <p class="rd-tagline">${profile.bio}</p>
            <div class="rd-cta">
              <a class="btn primary" href="${profile.resume}" target="_blank" rel="noopener">📄 Open Résumé (PDF) ↗</a>
              <a class="btn" href="mailto:${profile.email}">✉ ${profile.email}</a>
              <a class="btn" href="${profile.github}" target="_blank" rel="noopener">GitHub (@sammy-master) ↗</a>
              <a class="btn" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
            </div>
          </div>
        </div>

        <!-- Key Metrics Strip -->
        <div class="rd-metrics">
          ${profile.highlights.map((h) => `
            <div class="rd-stat">
              <b>${h.k}</b>
              <span>${h.l}</span>
              <em>${h.sub}</em>
            </div>`).join('')}
        </div>

        <!-- Clean Section Tabs (Default opens Overview + Featured Projects cleanly) -->
        <div class="rd-tabs" id="rd-tabs">
          <button type="button" class="active" data-tab="overview">✦ Executive Overview</button>
          <button type="button" data-tab="projects">🚀 All Projects (${projects.length})</button>
          <button type="button" data-tab="certs">🏆 All Certificates (${certs.length})</button>
          <button type="button" data-tab="chapters">🎮 10 Interactive Chapters</button>
          <button type="button" data-tab="blogs">✍️ Engineering Essays (${blogs.length})</button>
        </div>

        <!-- TAB 1: Executive Overview (Timeline + Skills + Top 6 Projects) -->
        <section class="rd-sec" data-sec="overview">
          <div class="rd-2col">
            <div class="rd-box">
              <h3>Experience & Education Timeline</h3>
              <div class="rd-timeline">
                ${timeline.map((t) => `
                  <div class="rd-tl-item">
                    <div class="rd-tl-yr">${t.year}</div>
                    <div class="rd-tl-body">
                      <h4>${t.title}</h4>
                      <em>${t.subtitle}</em>
                      <p>${t.desc}</p>
                      <div class="rd-tl-tags">${t.tags.map((tg) => `<span>${tg}</span>`).join('')}</div>
                    </div>
                  </div>`).join('')}
              </div>
            </div>

            <div class="rd-box">
              <h3>Core Technical Stack</h3>
              <div class="r-cols">
                ${categories.map((c) => {
                  const list = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id));
                  return `
                    <div class="rd-skill-col">
                      <h4 style="color:${c.color}">${c.label}</h4>
                      <ul class="r-skills">
                        ${list.map((s) => `<li><span>${s.name}</span><em>${s.lvl}%</em></li>`).join('')}
                      </ul>
                    </div>`;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="rd-sec-h" style="margin-top:1.4rem">
            <h3>Flagship Deployed Projects</h3>
            <button type="button" class="btn small" data-switch-tab="projects">View All ${projects.length} Projects →</button>
          </div>
          <div class="vault-grid">
            ${projects.slice(0, 6).map((p) => `
              <div class="vcard" style="--c:${p.color}">
                <div class="v-in">
                  <span class="v-tag">${p.tag}</span>
                  <h3>${p.name}</h3>
                  <p>${p.blurb}</p>
                  <div class="v-links">
                    ${p.demo ? `<a class="btn primary small" href="${p.demo}" target="_blank" rel="noopener">● Live Demo ↗</a>` : ''}
                    <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- TAB 2: All 16 Shipped Projects -->
        <section class="rd-sec" data-sec="projects" style="display:none">
          <div class="rd-sec-h">
            <h3>All ${projects.length} Shipped Projects & Repositories</h3>
            <span>Click <b>Live Demo ↗</b> or <b>GitHub ↗</b> to open in a new tab</span>
          </div>
          <div class="vault-grid">
            ${projects.map((p) => `
              <div class="vcard" style="--c:${p.color}">
                <div class="v-in">
                  <span class="v-tag">${p.tag}</span>
                  <h3>${p.name}</h3>
                  <p>${p.blurb}</p>
                  <div class="v-links">
                    ${p.demo ? `<a class="btn primary small" href="${p.demo}" target="_blank" rel="noopener">● Live Demo ↗</a>` : ''}
                    <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- TAB 3: All 37 Verified Certificates -->
        <section class="rd-sec" data-sec="certs" style="display:none">
          <div class="rd-sec-h">
            <h3>Verified Certificates & Credentials (${certs.length})</h3>
            <span>Click any card to open the verified high-resolution PDF</span>
          </div>
          <div class="cert-gallery">
            ${certs.map((c) => `
              <a class="cg-card ${c.hot ? 'hot' : ''}" href="${c.pdf}" target="_blank" rel="noopener">
                <div class="cg-img">
                  <img src="${c.thumb}" alt="${c.title}" loading="lazy" />
                  ${c.hot ? '<span class="cg-hot-badge">★ FEATURED</span>' : ''}
                </div>
                <div class="cg-body">
                  <span class="cg-cat">${c.cat}</span>
                  <h4>${c.title}</h4>
                  <p>${c.issuer}</p>
                  <span class="cg-open">📄 Open Verified PDF ↗</span>
                </div>
              </a>`).join('')}
          </div>
        </section>

        <!-- TAB 4: 10 Interactive Chapters -->
        <section class="rd-sec" data-sec="chapters" style="display:none">
          <div class="rd-sec-h">
            <h3>10 Interactive Story Chapters</h3>
            <span>Launch any 10-second micro-game or inspect its unlocked certificates</span>
          </div>
          <div class="rd-chap-grid">
            ${missions.map((m, idx) => `
              <div class="rd-chap" style="--c:${m.color}">
                <div class="rdc-top"><b>${pad(m.n)} · ${m.year}</b><span>${m.title}</span></div>
                <p>${m.story}</p>
                <div class="rdc-actions">
                  <button type="button" class="btn primary small" data-play="${idx}">▶ Play Mini-Game</button>
                  <button type="button" class="btn small" data-read="${idx}">📖 Certs & Skills (${(m.certs || []).length})</button>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- TAB 5: Personal Blogs & Essays -->
        <section class="rd-sec" data-sec="blogs" style="display:none">
          <div class="rd-sec-h">
            <h3>Personal Essays & Engineering Blogs (${blogs.length})</h3>
          </div>
          <div class="rd-blogs">
            ${blogs.map((b, i) => `
              <details class="rd-blog-card" ${i === 0 ? 'open' : ''}>
                <summary>
                  <div><span class="bi-tag">${b.tag} · ${b.date} · ${b.readTime}</span><h4>${b.title}</h4><p>${b.excerpt}</p></div>
                  <span class="btn small">Read Essay ▾</span>
                </summary>
                <div class="br-body">${b.paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>
              </details>`).join('')}
          </div>
        </section>
      </div>`, 'recruiter wide');

    function activateTab(tab) {
      e.panel.querySelectorAll('#rd-tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
      e.panel.querySelectorAll('.rd-sec').forEach((sec) => {
        sec.style.display = sec.dataset.sec === tab ? '' : 'none';
      });
    }

    $('#rd-tabs', e.panel).addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      audio.sfx.click();
      activateTab(b.dataset.tab);
    });

    e.panel.addEventListener('click', (ev) => {
      const sw = ev.target.closest('[data-switch-tab]');
      if (sw) {
        audio.sfx.click();
        activateTab(sw.dataset.switchTab);
        return;
      }
      const playBtn = ev.target.closest('[data-play]');
      if (playBtn) {
        const idx = Number(playBtn.dataset.play);
        audio.sfx.click();
        e.close();
        actions?.playMission?.(idx);
        return;
      }
      const readBtn = ev.target.closest('[data-read]');
      if (readBtn) {
        const idx = Number(readBtn.dataset.read);
        audio.sfx.click();
        e.close();
        actions?.inspectMission?.(missions[idx]);
      }
    });

    return e;
  },

  // ---------- Finale ----------
  finale(actions = globalActions) {
    const e = mount(`
      <div class="eyebrow">ALL 10 MISSIONS CLEARED</div>
      <h2>The Core is <span class="grad">100% Forged</span>.</h2>
      <p class="lead">You just played through my entire journey — from a first <code>printf("hi");</code> in school to Bosch and Smart India Hackathon 2026. Let's build something together!</p>
      <div class="p-actions">
        <button class="btn primary big" type="button" data-a="recruiter">⚡ OPEN FULL DOSSIER</button>
        <button class="btn big" type="button" data-a="certs">🏆 VIEW ALL 37+ CERTIFICATES</button>
        <button class="btn big" type="button" data-a="contact">✉ CONTACT ME</button>
      </div>`, 'finale');
    e.panel.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (b) { e.close(); setTimeout(() => actions[b.dataset.a]?.(), 250); }
    });
    return e;
  },
};
