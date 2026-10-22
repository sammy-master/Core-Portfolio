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

function mount(html, cls = '', { side = false, closable = true, backLabel = '← Back [ESC]' } = {}) {
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
  gsap.fromTo(wrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 });
  gsap.fromTo(panel, { y: side ? 0 : 20, x: side ? 44 : 0, scale: 0.98, opacity: 0 }, { y: 0, x: 0, scale: 1, opacity: 1, duration: 0.36, ease: 'expo.out' });
  if (closable) {
    $('.p-close', wrap)?.addEventListener('click', () => { audio.sfx.click(); close(); });
    $('.p-back', wrap)?.addEventListener('click', () => { audio.sfx.click(); close(); });
  }
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap && closable) { audio.sfx.click(); close(); } });
  function close() {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    gsap.to(panel, { y: 14, opacity: 0, scale: 0.98, duration: 0.16, ease: 'power2.in' });
    gsap.to(wrap, { autoAlpha: 0, duration: 0.2, onComplete: () => { wrap.remove(); panelHandlers.close(entry, stack.length); } });
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

  // ---------- Minimalist Chrome (Clean Top Bar + Bottom Dock, Zero Overlapping Hints) ----------
  chrome(actions) {
    globalActions = actions;
    const top = document.createElement('header');
    top.className = 'topbar';
    top.setAttribute('data-ui', '');
    top.innerHTML = `
      <div class="tb-left">
        <button class="esc-btn" id="btn-esc-menu" type="button" title="Command Menu [ESC]">
          <i>☰</i><span>ESC</span>
        </button>

        <div class="brand" id="brand-home" title="About Saksham Sharma">
          <img src="${profile.avatar}" alt="Saksham" class="brand-av" />
          <div class="brand-txt"><span class="logo">SAKSHAM</span><span class="brand-t">CSE · PCU</span></div>
        </div>
      </div>

      <div class="mode-switch" role="tablist" aria-label="3D World Mode">
        <button type="button" data-mode="orrery" class="active" title="Solar System Orrery"><i>🌌</i><span>Solar</span></button>
        <button type="button" data-mode="drive" title="Forza Horizon Drive"><i>🏎️</i><span>Drive</span></button>
        <button type="button" data-mode="shooter" title="Tactical FPS Range"><i>🎯</i><span>FPS</span></button>
      </div>

      <div class="tb-right">
        <div class="lv" title="Level & Chapters Cleared">
          <span class="lv-n">LV <b id="lv-n">1</b></span>
          <span class="lv-sep">·</span>
          <span class="clear-c"><b id="cl-n">0</b>/${missions.length}</span>
        </div>

        <button class="icon-btn" id="btn-sound" type="button" aria-label="Toggle sound">🔊</button>
      </div>`;

    const dock = document.createElement('nav');
    dock.className = 'dock';
    dock.setAttribute('data-ui', '');
    dock.setAttribute('aria-label', 'Portfolio Navigation');
    dock.innerHTML = `
      <button type="button" data-a="card"><span>About</span></button>
      <button type="button" data-a="vault"><span>Projects</span><em>${projects.length}</em></button>
      <button type="button" data-a="certs"><span>Certificates</span><em>${certs.length}</em></button>
      <button type="button" data-a="blogs"><span>Stories</span></button>
      <button type="button" data-a="contact"><span>Contact</span></button>
      <button type="button" data-a="recruiter" class="alt"><i>⚡</i><span>Recruiter View</span></button>`;

    const ui_ = $('#ui');
    ui_.append(top, dock);

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

    const sb = $('#btn-sound');
    const syncSound = (m) => { sb.textContent = m ? '🔇' : '🔊'; sb.setAttribute('aria-pressed', String(m)); };
    syncSound(audio.muted);
    audio.onMute(syncSound);
    sb.addEventListener('click', () => { audio.toggle(); store.state.muted = audio.muted; store.save(); });

    gsap.set([top, dock], { autoAlpha: 0 });

    function sync() {
      $('#lv-n').textContent = store.level;
      const n = store.state.god ? missions.length : store.clearedCount();
      $('#cl-n').textContent = n;
      modeSwitch.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('active', b.dataset.mode === store.state.worldMode);
      });
    }

    return {
      show() { sync(); gsap.to([top, dock], { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out' }); },
      hide() { gsap.to([top, dock], { autoAlpha: 0, duration: 0.2 }); },
      hideHint() {},
      update: sync,
    };
  },

  toast(msg, ms = 3200) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.textContent = msg;
    box.appendChild(t);
    gsap.fromTo(t, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out' });
    gsap.to(t, { opacity: 0, y: -8, duration: 0.25, delay: ms / 1000, onComplete: () => t.remove() });
  },

  // ---------- ESC Pause & Quick Command Menu ----------
  pauseMenu(actions = globalActions) {
    const curMode = store.state.worldMode || 'orrery';
    const curDiff = store.state.difficulty || 'normal';
    const e = mount(`
      <div class="eyebrow">COMMAND MENU</div>
      <h2>Navigation & World Settings</h2>

      <div class="pm-section">
        <h4>3D Mode</h4>
        <div class="mode-cards">
          <button type="button" class="mcard ${curMode === 'orrery' ? 'active' : ''}" data-m="orrery">
            <b>🌌 Solar Core</b>
            <span>Orbit the 10-planet solar system & play micro-missions.</span>
          </button>
          <button type="button" class="mcard ${curMode === 'drive' ? 'active' : ''}" data-m="drive">
            <b>🏎️ Forza Drive</b>
            <span>Drive the cyber-supercar through mission gates & project pit-stops.</span>
          </button>
          <button type="button" class="mcard ${curMode === 'shooter' ? 'active' : ''}" data-m="shooter">
            <b>🎯 FPS Range</b>
            <span>Aim and shoot holographic targets to unlock chapters.</span>
          </button>
        </div>
      </div>

      <div class="pm-section">
        <h4>Sections</h4>
        <div class="pm-nav-grid">
          <button type="button" class="btn primary" data-nav="recruiter">⚡ Recruiter Dossier</button>
          <button type="button" class="btn" data-nav="card">About & Skills</button>
          <button type="button" class="btn" data-nav="vault">Projects (${projects.length})</button>
          <button type="button" class="btn" data-nav="certs">Certificates (${certs.length})</button>
          <button type="button" class="btn" data-nav="blogs">Stories (${blogs.length})</button>
          <button type="button" class="btn" data-nav="contact">Contact</button>
        </div>
      </div>

      <div class="pm-section">
        <h4>Chapters (Play or Read)</h4>
        <div class="pm-missions">
          ${missions.map((m, idx) => `
            <div class="pm-mcard" style="--c:${m.color}">
              <div class="pm-mhead">
                <b>${pad(m.n)}</b>
                <span>${m.title}</span>
                <em>${store.isCleared(m.id) ? '✓' : m.year}</em>
              </div>
              <div class="pm-mbtns">
                <button type="button" class="btn primary small" data-play="${idx}">▶ Play</button>
                <button type="button" class="btn small" data-read="${idx}">Story</button>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div class="pm-section pm-settings">
        <div class="pm-diff-row">
          <span>DIFFICULTY</span>
          <button type="button" class="f-btn ${curDiff === 'chill' ? 'active' : ''}" data-diff="chill">Chill</button>
          <button type="button" class="f-btn ${curDiff === 'normal' ? 'active' : ''}" data-diff="normal">Normal</button>
          <button type="button" class="f-btn ${curDiff === 'pro' ? 'active' : ''}" data-diff="pro">Pro</button>
        </div>
        <div class="pm-diff-row">
          <a class="btn small" href="${profile.resume}" target="_blank" rel="noopener">Résumé PDF ↗</a>
          <button type="button" class="btn small" id="pm-god">⚡ ${store.state.god ? 'Disable' : 'Enable'} Unlock All</button>
        </div>
      </div>`, 'pause-modal wide', { backLabel: '← Resume [ESC]' });

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
        ui.toast(`Difficulty: ${DIFFICULTIES[d].label}`);
      });
    });

    $('#pm-god', e.panel)?.addEventListener('click', () => {
      store.state.god = !store.state.god;
      store.save();
      audio.sfx.win();
      e.close();
      ui.toast(store.state.god ? 'All chapters unlocked' : 'God Mode disabled');
    });

    return e;
  },

  // ---------- Minimalist Welcome Briefing ----------
  briefing(actions = globalActions) {
    return new Promise((resolve) => {
      const e = mount(`
        <div class="brief-hero">
          <img src="${profile.avatar}" alt="${profile.name}" class="brief-av" />
          <div>
            <div class="eyebrow">INTERACTIVE PORTFOLIO</div>
            <h2>Hey, I'm <span class="grad">Saksham Sharma</span>.</h2>
            <p class="lead">${profile.tagline}</p>
          </div>
        </div>
        <p class="brief-bio">${profile.bio}</p>
        <div class="mode-cards">
          <button type="button" class="mcard active" data-m="orrery">
            <b>🌌 Solar Core</b>
            <span>Orbit 10 interactive chapters & play quick 10-second missions.</span>
          </button>
          <button type="button" class="mcard" data-m="drive">
            <b>🏎️ Forza Drive</b>
            <span>Drive a cyber-supercar through mission gates & project pit-stops.</span>
          </button>
          <button type="button" class="mcard" data-m="shooter">
            <b>🎯 FPS Range</b>
            <span>Aim and shoot holographic targets to unlock chapters.</span>
          </button>
        </div>
        <div class="p-actions">
          <button class="btn primary big" type="button" id="brief-go">▶ Enter World</button>
          <button class="btn big" type="button" id="brief-recruiter">⚡ Recruiter Dossier</button>
        </div>`, 'brief wide', { closable: true, backLabel: '▶ Enter World' });

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
          <div class="sk-h"><span>${s.name}</span><em>${s.lvl}%</em></div>
          <div class="sk-bar"><i data-w="${s.lvl}"></i></div>
        </div>`).join('');

      const certsHtml = (m.certs && m.certs.length) ? `
        <div class="rv-sec">
          <div class="unlock"><span class="tag" style="--c:${m.color}">CERTIFICATES (${m.certs.length})</span></div>
          <div class="rv-certs">
            ${m.certs.map((c) => `
              <a class="rv-cert" href="${c.pdf}" target="_blank" rel="noopener">
                <div class="rvc-thumb"><img src="${c.thumb}" alt="${c.title}" loading="lazy" /></div>
                <div class="rvc-txt">
                  <b>${c.title}</b>
                  <span>${c.issuer}</span>
                  <em>Open PDF ↗</em>
                </div>
              </a>`).join('')}
          </div>
        </div>` : '';

      const projsHtml = m.projects.length ? `
        <div class="rv-sec">
          <div class="unlock"><span class="tag" style="--c:${m.color}">PROJECTS</span></div>
          <div class="rv-projs">
            ${m.projects.map((p) => `
              <div class="proj-pill">
                <b>${p.name}</b>
                <div class="pp-links">
                  ${p.demo ? `<a class="chip live" href="${p.demo}" target="_blank" rel="noopener">Live Demo ↗</a>` : ''}
                  <a class="chip" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
                </div>
              </div>`).join('')}
          </div>
        </div>` : '';

      const e = mount(`
        <div class="rv-num" style="--c:${m.color}">${pad(m.n)}</div>
        <div class="eyebrow" style="color:${m.color}">CHAPTER ${pad(m.n)} · ${m.year}</div>
        <h2>${m.title}</h2>
        <p class="story" id="rv-story">${m.story}</p>

        <div class="unlock">
          <span class="tag" style="--c:${m.color}">SKILLS</span>
          ${first && !skipped ? `<span class="xp-chip">+${Math.round((130 + bonus) * store.diff.xpMult)} XP</span>` : ''}
        </div>
        <div class="skills">${skillsHtml}</div>

        ${certsHtml}
        ${projsHtml}

        <div class="p-actions">
          <button class="btn primary big" type="button" id="rv-go">Continue ▸</button>
        </div>`, 'reveal reveal-wide', { side: true, closable: true, backLabel: '← Back' });

      const bars = e.panel.querySelectorAll('.sk-bar i');
      bars.forEach((b, i) => gsap.fromTo(b, { scaleX: 0 }, { scaleX: Number(b.dataset.w) / 100, duration: 0.75, delay: 0.15 + i * 0.1, ease: 'expo.out', onStart: () => audio.sfx.coin() }));
      $('#rv-go', e.panel).addEventListener('click', () => { audio.sfx.click(); e.close(); resolve(); });
      e.onClose = () => resolve();
    });
  },

  // ---------- Minimalist Tabbed About & Skills Modal (Uncluttered & Breathable) ----------
  card() {
    const cats = categories.map((c) => {
      const all = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id).map((s) => ({ ...s, m })));
      const potential = all.length ? all.reduce((a, s) => a + s.lvl, 0) / all.length : 0;
      return { ...c, all, potential };
    });
    const R = 105, cx = 160, cy = 145;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / cats.length;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];
    const ring = (f) => cats.map((_, i) => pt(i, 100 * f).join(',')).join(' ');
    const axes = cats.map((c, i) => {
      const [x, y] = pt(i, 100);
      const [lx, ly] = pt(i, 122);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${c.label}</text>`;
    }).join('');
    const poly = (k) => cats.map((c, i) => pt(i, c[k]).join(',')).join(' ');

    const e = mount(`
      <div class="pc-hero">
        <img src="${profile.avatar}" alt="${profile.name}" class="pc-av" />
        <div class="pc-hero-info">
          <div class="rank">
            <span class="rd-pill avail">● ${profile.status}</span>
            <span class="rd-pill">${profile.school} (${profile.batch})</span>
            <span class="rd-pill">${profile.location}</span>
          </div>
          <h2>${profile.name}</h2>
          <p class="pc-bio">${profile.bio}</p>
          <div class="rd-cta" style="margin-top:0.85rem">
            <a class="btn primary small" href="${profile.resume}" target="_blank" rel="noopener">Résumé PDF ↗</a>
            <a class="btn small" href="${profile.github}" target="_blank" rel="noopener">GitHub ↗</a>
            <a class="btn small" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
            <button class="btn small" type="button" id="unlock-all-btn">⚡ Unlock All Chapters</button>
          </div>
        </div>
      </div>

      <!-- Clean Minimalist Sub-Tabs so content is never congested -->
      <div class="rd-tabs" id="about-tabs">
        <button type="button" class="active" data-atab="bio">Overview & Personality</button>
        <button type="button" data-atab="skills">Skills & 6-Axis Radar</button>
        <button type="button" data-atab="timeline">Education & Journey</button>
      </div>

      <!-- TAB 1: Overview, Personality & Interests -->
      <section class="about-sec" data-asec="bio">
        <div class="rd-metrics" style="margin-bottom:1.4rem">
          ${profile.highlights.map((h) => `
            <div class="rd-stat">
              <b>${h.k}</b>
              <span>${h.l}</span>
              <em>${h.sub}</em>
            </div>`).join('')}
        </div>

        <h4 class="min-h">How I Work & Think</h4>
        <div class="pers-grid" style="margin-bottom:1.4rem">
          ${profile.personality.map((p) => `
            <div class="pers-card">
              <b>${p.icon} ${p.title}</b>
              <p>${p.text}</p>
            </div>`).join('')}
        </div>

        <h4 class="min-h">Interests & Hobbies</h4>
        <div class="hobby-chips">
          ${profile.hobbies.map((h) => `<span class="h-chip"><b>${h.tag}</b> ${h.name}</span>`).join('')}
        </div>
      </section>

      <!-- TAB 2: 6-Axis Radar + Clean Skill Matrix -->
      <section class="about-sec" data-asec="skills" style="display:none">
        <div class="card-grid">
          <div class="rd-box" style="text-align:center">
            <h4 class="min-h">6-Axis Skill Radar</h4>
            <svg class="radar" viewBox="0 0 320 290" role="img" aria-label="Skill radar chart">
              <g class="rings">${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}"/>`).join('')}</g>
              <g class="axes">${axes}</g>
              <polygon class="potential" points="${poly('potential')}"/>
              <polygon class="value" id="radar-v" points="${cats.map((c, i) => pt(i, c.potential).join(',')).join(' ')}"/>
            </svg>
          </div>

          <div class="skill-cats-grid">
            ${cats.map((c) => `
              <div class="sc-box">
                <h5 style="color:${c.color}">${c.label}</h5>
                <div class="cat-skills">
                  ${c.all.map((s) => `
                    <div class="sk" style="--c:${s.m.color}">
                      <span>${s.name}</span><b>${s.lvl}%</b>
                    </div>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>
      </section>

      <!-- TAB 3: Education & Experience Timeline -->
      <section class="about-sec" data-asec="timeline" style="display:none">
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
      </section>`, 'card wide');

    $('#about-tabs', e.panel).addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      audio.sfx.click();
      const tab = b.dataset.atab;
      e.panel.querySelectorAll('#about-tabs button').forEach((x) => x.classList.toggle('active', x.dataset.atab === tab));
      e.panel.querySelectorAll('.about-sec').forEach((sec) => {
        sec.style.display = sec.dataset.asec === tab ? '' : 'none';
      });
    });

    $('#unlock-all-btn', e.panel).addEventListener('click', () => {
      store.state.god = true;
      missions.forEach((m) => store.markCleared(m.id, false, 40));
      store.save();
      audio.sfx.win();
      ui.toast('All 10 chapters unlocked');
    });
    return e;
  },

  // ---------- Project Vault (All 16 Projects with Live Demo + GitHub Links) ----------
  vault() {
    const e = mount(`
      <div class="eyebrow">PROJECTS · ${projects.length} DEPLOYMENTS & REPOS</div>
      <h2>Shipped Projects</h2>
      <p class="sub">Test the live Vercel deployments or inspect the source code on GitHub.</p>
      <div class="vault-grid">
        ${projects.map((p, i) => `
          <div class="vcard" style="--c:${p.color};--i:${i}">
            <div class="v-in">
              <span class="v-tag">${p.tag}</span>
              <h3>${p.name}</h3>
              <p>${p.blurb}</p>
              <div class="v-links">
                ${p.demo ? `<a class="btn primary small" href="${p.demo}" target="_blank" rel="noopener">Live Demo ↗</a>` : ''}
                <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
              </div>
            </div>
          </div>`).join('')}
      </div>`, 'vault wide');
    return e;
  },

  // ---------- Visual Certificate Gallery ----------
  certs() {
    const catList = ['All', 'Flagship', 'Cybersecurity', 'Linux & OS', 'Web & Software', 'Languages', 'Professional'];
    const e = mount(`
      <div class="eyebrow">VERIFIED CREDENTIALS · ${certs.length} CERTIFICATES</div>
      <h2>Certifications & Hackathons</h2>
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
            ${c.hot ? '<span class="cg-hot-badge">FEATURED</span>' : ''}
          </div>
          <div class="cg-body">
            <span class="cg-cat">${c.cat}</span>
            <h4>${c.title}</h4>
            <p>${c.issuer}</p>
            <span class="cg-open">Open PDF ↗</span>
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
      <div class="eyebrow">NOTES & ESSAYS</div>
      <h2>Stories & Engineering Logs</h2>
      <div class="blog-layout">
        <div class="blog-list" id="blog-list">
          ${blogs.map((b, i) => `
            <button type="button" class="blog-item ${i === 0 ? 'active' : ''}" data-id="${b.id}">
              <span class="bi-tag">${b.tag} · ${b.readTime}</span>
              <h4>${b.title}</h4>
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
          <button type="button" class="btn small" data-goto="${prev.id}">← Previous</button>
          <button type="button" class="btn primary small" data-goto="${next.id}">Next Essay →</button>
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
      <div class="eyebrow">CONTACT · PUNE, INDIA</div>
      <h2>Let's build <span class="grad">something great</span>.</h2>
      <p class="lead">${profile.status} — internships, full-stack engineering, AI/ML systems, and hackathons.</p>
      <div class="contact-grid">
        <a class="c-btn primary" href="mailto:${profile.email}"><i>✉</i><span><b>Email</b>${profile.email}</span></a>
        <button class="c-btn" type="button" id="copy-mail"><i>⧉</i><span><b>Copy Email</b>Copy to clipboard</span></button>
        <a class="c-btn" href="${profile.linkedin}" target="_blank" rel="noopener"><i>in</i><span><b>LinkedIn</b>saksham-sharma-14sept ↗</span></a>
        <a class="c-btn" href="${profile.github}" target="_blank" rel="noopener"><i>⌥</i><span><b>GitHub</b>@sammy-master ↗</span></a>
        <a class="c-btn" href="${profile.resume}" target="_blank" rel="noopener"><i>📄</i><span><b>Résumé</b>Open PDF ↗</span></a>
      </div>`, 'contact');
    $('#copy-mail', e.panel).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(profile.email); ui.toast('Email copied ✓'); audio.sfx.coin(); }
      catch { ui.toast(profile.email); }
    });
    return e;
  },

  // ---------- Minimalist Executive Recruiter Dossier ----------
  recruiter(actions = globalActions) {
    const e = mount(`
      <div class="rec-dossier">
        <div class="rd-hero">
          <img src="${profile.avatar}" alt="${profile.name}" class="rd-avatar" />
          <div class="rd-hero-main">
            <div class="rd-badges">
              <span class="rd-pill avail">● ${profile.status}</span>
              <span class="rd-pill">${profile.school} (${profile.batch})</span>
              <span class="rd-pill">${profile.location}</span>
            </div>
            <h2>${profile.name}</h2>
            <p class="rd-tagline">${profile.bio}</p>
            <div class="rd-cta">
              <a class="btn primary small" href="${profile.resume}" target="_blank" rel="noopener">Résumé PDF ↗</a>
              <a class="btn small" href="mailto:${profile.email}">${profile.email}</a>
              <a class="btn small" href="${profile.github}" target="_blank" rel="noopener">GitHub ↗</a>
              <a class="btn small" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn ↗</a>
            </div>
          </div>
        </div>

        <div class="rd-metrics">
          ${profile.highlights.map((h) => `
            <div class="rd-stat">
              <b>${h.k}</b>
              <span>${h.l}</span>
              <em>${h.sub}</em>
            </div>`).join('')}
        </div>

        <div class="rd-tabs" id="rd-tabs">
          <button type="button" class="active" data-tab="overview">Overview</button>
          <button type="button" data-tab="projects">Projects (${projects.length})</button>
          <button type="button" data-tab="certs">Certificates (${certs.length})</button>
          <button type="button" data-tab="chapters">Chapters (10)</button>
          <button type="button" data-tab="blogs">Essays (${blogs.length})</button>
        </div>

        <!-- TAB 1: Clean 2-Column Overview -->
        <section class="rd-sec" data-sec="overview">
          <div class="rd-2col">
            <div class="rd-box">
              <h3>Experience & Education</h3>
              <div class="rd-timeline">
                ${timeline.map((t) => `
                  <div class="rd-tl-item">
                    <div class="rd-tl-yr">${t.year}</div>
                    <div class="rd-tl-body">
                      <h4>${t.title}</h4>
                      <em>${t.subtitle}</em>
                      <p>${t.desc}</p>
                    </div>
                  </div>`).join('')}
              </div>
            </div>

            <div class="rd-box">
              <h3>Technical Stack</h3>
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
        </section>

        <!-- TAB 2: All 16 Shipped Projects -->
        <section class="rd-sec" data-sec="projects" style="display:none">
          <div class="vault-grid">
            ${projects.map((p) => `
              <div class="vcard" style="--c:${p.color}">
                <div class="v-in">
                  <span class="v-tag">${p.tag}</span>
                  <h3>${p.name}</h3>
                  <p>${p.blurb}</p>
                  <div class="v-links">
                    ${p.demo ? `<a class="btn primary small" href="${p.demo}" target="_blank" rel="noopener">Live Demo ↗</a>` : ''}
                    <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- TAB 3: All 37 Verified Certificates -->
        <section class="rd-sec" data-sec="certs" style="display:none">
          <div class="cert-gallery">
            ${certs.map((c) => `
              <a class="cg-card ${c.hot ? 'hot' : ''}" href="${c.pdf}" target="_blank" rel="noopener">
                <div class="cg-img">
                  <img src="${c.thumb}" alt="${c.title}" loading="lazy" />
                  ${c.hot ? '<span class="cg-hot-badge">FEATURED</span>' : ''}
                </div>
                <div class="cg-body">
                  <span class="cg-cat">${c.cat}</span>
                  <h4>${c.title}</h4>
                  <p>${c.issuer}</p>
                  <span class="cg-open">Open PDF ↗</span>
                </div>
              </a>`).join('')}
          </div>
        </section>

        <!-- TAB 4: 10 Interactive Chapters -->
        <section class="rd-sec" data-sec="chapters" style="display:none">
          <div class="rd-chap-grid">
            ${missions.map((m, idx) => `
              <div class="rd-chap" style="--c:${m.color}">
                <div class="rdc-top"><b>${pad(m.n)} · ${m.year}</b><span>${m.title}</span></div>
                <p>${m.story}</p>
                <div class="rdc-actions">
                  <button type="button" class="btn primary small" data-play="${idx}">▶ Play</button>
                  <button type="button" class="btn small" data-read="${idx}">Certs (${(m.certs || []).length})</button>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- TAB 5: Personal Blogs & Essays -->
        <section class="rd-sec" data-sec="blogs" style="display:none">
          <div class="rd-blogs">
            ${blogs.map((b, i) => `
              <details class="rd-blog-card" ${i === 0 ? 'open' : ''}>
                <summary>
                  <div><span class="bi-tag">${b.tag} · ${b.readTime}</span><h4>${b.title}</h4></div>
                  <span class="btn small">Read ▾</span>
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
      <div class="eyebrow">ALL 10 CHAPTERS CLEARED</div>
      <h2>The Core is <span class="grad">100% Forged</span>.</h2>
      <p class="lead">You played through my entire journey — from my first C++ program to Bosch and Smart India Hackathon 2026.</p>
      <div class="p-actions">
        <button class="btn primary big" type="button" data-a="recruiter">⚡ Recruiter Dossier</button>
        <button class="btn big" type="button" data-a="certs">Certificates (${certs.length})</button>
        <button class="btn big" type="button" data-a="contact">Contact Me</button>
      </div>`, 'finale');
    e.panel.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (b) { e.close(); setTimeout(() => actions[b.dataset.a]?.(), 250); }
    });
    return e;
  },
};
