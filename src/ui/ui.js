import gsap from 'gsap';
import { profile, timeline, categories, missions, projects, certs, blogs } from '../data/content.js';
import { store, DIFFICULTIES } from '../engine/store.js';
import { audio } from '../engine/audio.js';

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const RANKS = ['Rookie', 'Apprentice', 'Builder', 'Engineer', 'Architect', 'Legend'];
const rankOf = (lv) => RANKS[Math.min(RANKS.length - 1, lv - 1)];
const levelName = (v) => (v >= 85 ? 'STRONG' : v >= 70 ? 'PROFICIENT' : v >= 50 ? 'FAMILIAR' : 'LEARNING');
const unlocked = (m) => store.state.god || store.isCleared(m.id);

const panelRoot = () => $('#panel-root');
let panelHandlers = { open: () => {}, close: () => {} };
const stack = [];

function mount(html, cls = '', { side = false, closable = true } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'panel-wrap' + (side ? ' side' : '');
  wrap.setAttribute('data-ui', '');
  wrap.innerHTML = `<div class="panel glass ${cls}" role="dialog" aria-modal="${!side}">${closable ? '<button class="p-close" type="button" aria-label="Close">✕</button>' : ''}${html}</div>`;
  panelRoot().appendChild(wrap);
  const panel = $('.panel', wrap);
  const entry = { wrap, panel, close };
  stack.push(entry);
  panelHandlers.open(entry);
  gsap.fromTo(wrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 });
  gsap.fromTo(panel, { y: side ? 0 : 32, x: side ? 64 : 0, scale: 0.96, opacity: 0 }, { y: 0, x: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' });
  if (closable) $('.p-close', wrap).addEventListener('click', () => { audio.sfx.click(); close(); });
  if (!side) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { audio.sfx.click(); close(); } });
  function close() {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    gsap.to(panel, { y: 24, opacity: 0, scale: 0.97, duration: 0.2, ease: 'power2.in' });
    gsap.to(wrap, { autoAlpha: 0, duration: 0.25, onComplete: () => { wrap.remove(); panelHandlers.close(entry, stack.length); } });
    entry.onClose?.();
  }
  return entry;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if ($('.p-close', top.wrap)) { audio.sfx.click(); top.close(); }
  }
});

export const ui = {
  onPanel(open, close) { panelHandlers = { open, close }; },
  get panelOpen() { return stack.length > 0; },
  closeAll() { [...stack].forEach((e) => e.close()); },

  // ---------- Chrome (Top HUD + Mode Switcher + Bottom Dock) ----------
  chrome(actions) {
    const top = document.createElement('header');
    top.className = 'topbar';
    top.setAttribute('data-ui', '');
    top.innerHTML = `
      <div class="brand" id="brand-home" title="Saksham Sharma // Core Portfolio">
        <img src="${profile.avatar}" alt="Saksham" class="brand-av" />
        <div class="brand-txt"><span class="logo">SAKSHAM</span><span class="brand-t">B.TECH CSE · PCU</span></div>
      </div>

      <div class="mode-switch" role="tablist" aria-label="3D World Mode">
        <button type="button" data-mode="orrery" class="active" title="God of War Realm Orrery"><i>🌌</i><span>REALM CORE</span></button>
        <button type="button" data-mode="drive" title="Forza Horizon 3D Drive Mode"><i>🏎️</i><span>FORZA DRIVE</span></button>
        <button type="button" data-mode="shooter" title="Valorant / CS2 Tactical Aim Range"><i>🎯</i><span>FPS RANGE</span></button>
      </div>

      <button class="diff-pill" id="btn-diff" type="button" title="Cycle game difficulty (Chill / Normal / Pro)">
        <span>MODE:</span> <b id="diff-lbl">NORMAL</b>
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
      <button type="button" data-a="recruiter" class="alt"><i>☰</i><span>Recruiter Dossier</span></button>`;

    const hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.id = 'world-hint';
    hint.innerHTML = '<span>DRAG TO ROTATE</span><i></i><span>CLICK ANY PORTAL TO PLAY</span><i></i><span>SWITCH TO 🏎️ DRIVE OR 🎯 FPS ABOVE</span>';

    const ui_ = $('#ui');
    ui_.append(top, dock, hint);

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
      const mode = b.dataset.mode;
      actions.setMode?.(mode);
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
        hint.innerHTML = '<span>DRAG TO ROTATE</span><i></i><span>CLICK ANY PORTAL TO PLAY</span><i></i><span>SWITCH TO 🏎️ DRIVE OR 🎯 FPS ABOVE</span>';
      } else if (store.state.worldMode === 'drive') {
        hint.innerHTML = '<span>WASD / ARROWS TO DRIVE</span><i></i><span>SPACE TO DRIFT · SHIFT NITRO</span><i></i><span>DRIVE INTO ANY ARCH TO LAUNCH</span>';
      } else {
        hint.innerHTML = '<span>AIM & CLICK TO SHOOT TARGET BOTS</span><i></i><span>HEADSHOT = INSTANT UNLOCK</span><i></i><span>PRESS [E] PLAY · [F] STORY</span>';
      }
    }

    return {
      show() { sync(); gsap.to([top, dock, hint], { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }); },
      hide() { gsap.to([top, dock, hint], { autoAlpha: 0, duration: 0.25 }); },
      hideHint() { gsap.to(hint, { autoAlpha: 0, duration: 0.35 }); },
      update: sync,
    };
  },

  toast(msg, ms = 4000) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.textContent = msg;
    box.appendChild(t);
    gsap.fromTo(t, { y: 24, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)' });
    gsap.to(t, { opacity: 0, y: -10, duration: 0.35, delay: ms / 1000, onComplete: () => t.remove() });
  },

  // ---------- Mission Briefing ----------
  briefing(actions) {
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
            <b>🌌 Realm Core</b>
            <span>Rotate the 3D orbital system & dive into 10 micro-missions (5–12s each).</span>
          </button>
          <button type="button" class="mcard" data-m="drive">
            <b>🏎️ Forza Drive</b>
            <span>Drive a cyber-supercar with live KM/H telemetry, drift through crates & enter gates!</span>
          </button>
          <button type="button" class="mcard" data-m="shooter">
            <b>🎯 Tactical FPS Range</b>
            <span>CS2 / Valorant firing range — snipe mission target bots to unlock chapters!</span>
          </button>
        </div>
        <div class="p-actions">
          <button class="btn primary big" type="button" id="brief-go">▶ START EXPLORING</button>
          <button class="btn big" type="button" id="brief-recruiter">☰ OPEN RECRUITER DOSSIER</button>
        </div>`, 'brief wide', { closable: true });

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
        audio.sfx.click(); e.close(); resolve(); setTimeout(() => ui.recruiter(actions), 250);
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
          <div class="unlock"><span class="tag" style="--c:${m.color}">🏆 CERTIFICATES EARNED IN THIS CHAPTER</span></div>
          <div class="rv-certs">
            ${m.certs.map((c) => `
              <a class="rv-cert" href="${c.pdf}" target="_blank" rel="noopener" title="Click to open official PDF certificate in new tab">
                <img src="${c.thumb}" alt="${c.title}" loading="lazy" />
                <div class="rvc-txt">
                  <b>${c.title}</b>
                  <span>${c.issuer} · View PDF ↗</span>
                </div>
              </a>`).join('')}
          </div>
        </div>` : '';

      const projsHtml = m.projects.length ? `
        <div class="rv-sec">
          <div class="unlock"><span class="tag" style="--c:${m.color}">🚀 PROJECTS BUILT WITH THESE SKILLS</span></div>
          <div class="chips">
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
        </div>`, 'reveal', { side: true, closable: true });

      const bars = e.panel.querySelectorAll('.sk-bar i');
      bars.forEach((b, i) => gsap.fromTo(b, { scaleX: 0 }, { scaleX: Number(b.dataset.w) / 100, duration: 0.9, delay: 0.25 + i * 0.14, ease: 'expo.out', onStart: () => audio.sfx.coin() }));
      gsap.from(e.panel.querySelectorAll('.skill, .rv-cert, .proj-pill'), { y: 14, opacity: 0, duration: 0.4, stagger: 0.06, delay: 0.2, ease: 'power3.out' });
      $('#rv-go', e.panel).addEventListener('click', () => { audio.sfx.click(); e.close(); resolve(); });
      e.onClose = () => resolve();
    });
  },

  // ---------- About, Personality, Hobbies & Skill Radar (Player Card) ----------
  card() {
    const cats = categories.map((c) => {
      const all = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id).map((s) => ({ ...s, m })));
      const got = all.filter((s) => unlocked(s.m));
      const potential = all.length ? all.reduce((a, s) => a + s.lvl, 0) / all.length : 0;
      const value = got.length ? got.reduce((a, s) => a + s.lvl, 0) / all.length : potential * 0.85;
      return { ...c, all, got, potential, value };
    });
    const R = 115, cx = 160, cy = 148;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / cats.length;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];
    const ring = (f) => cats.map((_, i) => pt(i, 100 * f).join(',')).join(' ');
    const axes = cats.map((c, i) => {
      const [x, y] = pt(i, 100);
      const [lx, ly] = pt(i, 124);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${c.label}</text>`;
    }).join('');
    const poly = (k) => cats.map((c, i) => pt(i, c[k]).join(',')).join(' ');
    const lv = store.level;

    const e = mount(`
      <div class="eyebrow">PLAYER PROFILE · ABOUT ME, PERSONALITY & SKILLS</div>
      <div class="card-grid">
        <div class="card-l">
          <div class="pc-hero">
            <img src="${profile.avatar}" alt="${profile.name}" class="pc-av" />
            <div>
              <h2>${profile.name}</h2>
              <div class="rank"><span class="badge">LV ${lv} · ${rankOf(lv)}</span><em>${profile.role}</em></div>
              <p class="pc-loc">📍 ${profile.school} (${profile.batch})</p>
            </div>
          </div>
          <p class="pc-bio">${profile.bio}</p>
          <svg class="radar" viewBox="0 0 320 296" role="img" aria-label="Skill radar chart">
            <g class="rings">${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}"/>`).join('')}</g>
            <g class="axes">${axes}</g>
            <polygon class="potential" points="${poly('potential')}"/>
            <polygon class="value" id="radar-v" points="${cats.map((_, i) => pt(i, 0).join(',')).join(' ')}"/>
          </svg>
          <div class="p-actions row">
            <a class="btn primary small" href="${profile.resume}" target="_blank" rel="noopener">📄 Résumé PDF ↗</a>
            <button class="btn small" type="button" id="unlock-all-btn">⚡ Unlock All Chapters</button>
            <button class="btn small" type="button" id="reset-btn">↺ Reset Save</button>
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

          ${cats.map((c) => `
            <div class="cat">
              <h4 style="color:${c.color}">${c.label}</h4>
              <div class="cat-skills">
                ${c.all.map((s) => `
                  <div class="sk" style="--c:${s.m.color}">
                    <span>${s.name}</span><b>${s.lvl}%</b>
                    <div class="sk-bar"><i style="transform:scaleX(${s.lvl / 100})"></i></div>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>`, 'card wide');

    const v = { t: 0 };
    gsap.to(v, {
      t: 1, duration: 1.1, delay: 0.2, ease: 'expo.out',
      onUpdate: () => { $('#radar-v', e.panel)?.setAttribute('points', cats.map((c, i) => pt(i, c.potential * v.t).join(',')).join(' ')); },
    });
    $('#unlock-all-btn', e.panel).addEventListener('click', () => {
      store.state.god = true;
      missions.forEach((m) => store.markCleared(m.id, false, 40));
      store.save();
      audio.sfx.win();
      ui.toast('⚡ All 10 chapters & skills unlocked!');
      e.close();
      ui.card();
    });
    $('#reset-btn', e.panel).addEventListener('click', () => {
      if (confirm('Reset all mission progress?')) { store.reset(); location.reload(); }
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
                <a class="btn small" href="${p.url}" target="_blank" rel="noopener">GitHub ↗</a>
              </div>
            </div>
          </div>`).join('')}
      </div>`, 'vault wide');

    const cards = e.panel.querySelectorAll('.vcard');
    gsap.from(cards, { y: 30, opacity: 0, duration: 0.5, stagger: 0.035, delay: 0.15, ease: 'power3.out' });
    cards.forEach((c) => {
      c.addEventListener('pointermove', (ev) => {
        const r = c.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
        c.style.setProperty('--ry', ((x - 0.5) * 16).toFixed(2) + 'deg');
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
      <p class="sub">Click any certificate card to open the full high-resolution PDF in a new tab.</p>
      <div class="filter-bar" id="cert-filters">
        ${catList.map((c, i) => `<button type="button" class="f-btn ${i === 0 ? 'active' : ''}" data-c="${c}">${c}</button>`).join('')}
      </div>
      <div class="cert-gallery" id="cert-grid"></div>`, 'certs-modal wide');

    const grid = $('#cert-grid', e.panel);
    function render(filter) {
      const list = filter === 'All' ? certs : certs.filter((c) => c.cat === filter);
      grid.innerHTML = list.map((c) => `
        <a class="cg-card ${c.hot ? 'hot' : ''}" href="${c.pdf}" target="_blank" rel="noopener">
          <div class="cg-img"><img src="${c.thumb}" alt="${c.title}" loading="lazy" /></div>
          <div class="cg-body">
            <span class="cg-cat">${c.cat}</span>
            <h4>${c.title}</h4>
            <p>${c.issuer}</p>
            <span class="cg-open">Open Verified PDF ↗</span>
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
      const b = blogs.find((x) => x.id === Number(id)) || blogs[0];
      reader.innerHTML = `
        <div class="br-meta"><span>${b.tag}</span> · <span>${b.date}</span> · <span>${b.readTime}</span></div>
        <h3>${b.title}</h3>
        <div class="br-body">${b.paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>`;
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

  // ---------- Executive Recruiter Dossier (Editorial Multi-Tab Showcase) ----------
  recruiter(actions) {
    const e = mount(`
      <div class="rec-dossier">
        <!-- Hero Banner -->
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

        <!-- Interactive Section Tabs -->
        <div class="rd-tabs" id="rd-tabs">
          <button type="button" class="active" data-tab="all">✦ Complete Overview</button>
          <button type="button" data-tab="projects">🚀 Shipped Projects (${projects.length})</button>
          <button type="button" data-tab="certs">🏆 Certificates (${certs.length})</button>
          <button type="button" data-tab="timeline">⏳ Experience & Journey</button>
          <button type="button" data-tab="blogs">✍️ Stories & Blogs (${blogs.length})</button>
        </div>

        <!-- Projects Section -->
        <section class="rd-sec" data-sec="projects">
          <div class="rd-sec-h">
            <h3>Featured & Shipped Projects</h3>
            <span>Click <b>Live Demo ↗</b> or <b>GitHub ↗</b> to inspect in a new tab</span>
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

        <!-- Experience, Education & Chapters Timeline -->
        <section class="rd-sec" data-sec="timeline">
          <div class="rd-sec-h">
            <h3>Experience, Education & Interactive Chapters</h3>
            <span>Play any chapter's 10-second micro-mission directly from here</span>
          </div>
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

          <h4 class="rd-subh">10 Interactive Story Chapters (Click to Play or Read)</h4>
          <div class="rd-chap-grid">
            ${missions.map((m, idx) => `
              <div class="rd-chap" style="--c:${m.color}">
                <div class="rdc-top"><b>${pad(m.n)} · ${m.year}</b><span>${m.title}</span></div>
                <p>${m.story}</p>
                <div class="rdc-actions">
                  <button type="button" class="btn primary small" data-play="${idx}">▶ Play ${m.title}</button>
                </div>
              </div>`).join('')}
          </div>
        </section>

        <!-- Skills & Personality -->
        <section class="rd-sec" data-sec="skills">
          <div class="rd-sec-h">
            <h3>Technical Skills, Personality & Interests</h3>
          </div>
          <div class="pers-grid" style="margin-bottom:1.1rem">
            ${profile.personality.map((p) => `
              <div class="pers-card">
                <b>${p.icon} ${p.title}</b>
                <p>${p.text}</p>
              </div>`).join('')}
          </div>
          <div class="r-cols">
            ${categories.map((c) => {
              const list = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id));
              return `
                <div class="rd-skill-col">
                  <h4 style="color:${c.color}">${c.label}</h4>
                  <ul class="r-skills">
                    ${list.map((s) => `<li><span>${s.name}</span><em>${levelName(s.lvl)} (${s.lvl}%)</em></li>`).join('')}
                  </ul>
                </div>`;
            }).join('')}
          </div>
        </section>

        <!-- Certificates Gallery -->
        <section class="rd-sec" data-sec="certs">
          <div class="rd-sec-h">
            <h3>Verified Certificates & Credentials (${certs.length})</h3>
            <span>Click any certificate to open the full PDF</span>
          </div>
          <div class="cert-gallery">
            ${certs.map((c) => `
              <a class="cg-card ${c.hot ? 'hot' : ''}" href="${c.pdf}" target="_blank" rel="noopener">
                <div class="cg-img"><img src="${c.thumb}" alt="${c.title}" loading="lazy" /></div>
                <div class="cg-body">
                  <span class="cg-cat">${c.cat}</span>
                  <h4>${c.title}</h4>
                  <p>${c.issuer}</p>
                  <span class="cg-open">Open PDF ↗</span>
                </div>
              </a>`).join('')}
          </div>
        </section>

        <!-- Blogs & Essays -->
        <section class="rd-sec" data-sec="blogs">
          <div class="rd-sec-h">
            <h3>Personal Essays & Engineering Blogs</h3>
          </div>
          <div class="rd-blogs">
            ${blogs.map((b) => `
              <details class="rd-blog-card">
                <summary>
                  <div><span class="bi-tag">${b.tag} · ${b.date} · ${b.readTime}</span><h4>${b.title}</h4><p>${b.excerpt}</p></div>
                  <span class="btn small">Read Essay ▾</span>
                </summary>
                <div class="br-body">${b.paragraphs.map((p) => `<p>${p}</p>`).join('')}</div>
              </details>`).join('')}
          </div>
        </section>
      </div>`, 'recruiter wide');

    // Tab switching
    $('#rd-tabs', e.panel).addEventListener('click', (ev) => {
      const b = ev.target.closest('button'); if (!b) return;
      audio.sfx.click();
      e.panel.querySelectorAll('#rd-tabs button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const tab = b.dataset.tab;
      e.panel.querySelectorAll('.rd-sec').forEach((sec) => {
        sec.style.display = (tab === 'all' || sec.dataset.sec === tab) ? '' : 'none';
      });
    });

    // Launch a mission directly from the Recruiter Dossier
    e.panel.addEventListener('click', (ev) => {
      const playBtn = ev.target.closest('[data-play]');
      if (playBtn) {
        const idx = Number(playBtn.dataset.play);
        audio.sfx.click();
        e.close();
        actions?.playMission?.(idx);
      }
    });

    return e;
  },

  // ---------- Finale ----------
  finale(actions) {
    const e = mount(`
      <div class="eyebrow">ALL 10 MISSIONS CLEARED</div>
      <h2>The Core is <span class="grad">100% Forged</span>.</h2>
      <p class="lead">You just played through my entire journey — from a first <code>printf("hi");</code> in school to Bosch and Smart India Hackathon 2026. Let's build something together!</p>
      <div class="p-actions">
        <button class="btn primary big" type="button" data-a="recruiter">☰ OPEN FULL DOSSIER</button>
        <button class="btn big" type="button" data-a="certs">🏆 VIEW ALL 37+ CERTIFICATES</button>
        <button class="btn big" type="button" data-a="contact">✉ CONTACT ME</button>
      </div>`, 'finale');
    e.panel.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-a]');
      if (b) { e.close(); setTimeout(() => actions[b.dataset.a]?.(), 300); }
    });
    return e;
  },
};
