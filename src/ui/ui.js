import gsap from 'gsap';
import { profile, categories, missions, projects, certs } from '../data/content.js';
import { store } from '../engine/store.js';
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
  gsap.fromTo(wrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
  gsap.fromTo(panel, { y: side ? 0 : 40, x: side ? 80 : 0, scale: 0.96, opacity: 0 }, { y: 0, x: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'expo.out' });
  if (closable) $('.p-close', wrap).addEventListener('click', () => { audio.sfx.click(); close(); });
  if (!side) wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) { audio.sfx.click(); close(); } });
  function close() {
    const i = stack.indexOf(entry);
    if (i < 0) return;
    stack.splice(i, 1);
    gsap.to(panel, { y: 30, opacity: 0, scale: 0.97, duration: 0.25, ease: 'power2.in' });
    gsap.to(wrap, { autoAlpha: 0, duration: 0.3, onComplete: () => { wrap.remove(); panelHandlers.close(entry, stack.length); } });
    entry.onClose?.();
  }
  return entry;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && stack.length) { const top = stack[stack.length - 1]; if ($('.p-close', top.wrap)) { audio.sfx.click(); top.close(); } }
});

export const ui = {
  onPanel(open, close) { panelHandlers = { open, close }; },
  get panelOpen() { return stack.length > 0; },
  closeAll() { [...stack].forEach((e) => e.close()); },

  // ---------- Chrome (top bar + dock) ----------
  chrome(actions) {
    const top = document.createElement('header');
    top.className = 'topbar';
    top.setAttribute('data-ui', '');
    top.innerHTML = `
      <div class="brand"><span class="logo">S<i>/</i>S</span><span class="brand-t">CORE</span></div>
      <div class="lv" title="Level"><div class="lv-n">LV <b id="lv-n">1</b></div><div class="lv-r"><span id="lv-rank">Rookie</span><div class="xp"><i id="xp-bar"></i></div></div></div>
      <div class="clear-c" aria-label="Missions cleared"><b id="cl-n">0</b><span>/${missions.length}</span><em>CLEARED</em></div>
      <button class="icon-btn" id="btn-sound" type="button" aria-label="Toggle sound">🔊</button>`;
    const dock = document.createElement('nav');
    dock.className = 'dock';
    dock.setAttribute('data-ui', '');
    dock.setAttribute('aria-label', 'Menu');
    dock.innerHTML = `
      <button type="button" data-a="card"><i>◈</i><span>Player Card</span></button>
      <button type="button" data-a="vault"><i>▣</i><span>Project Vault</span></button>
      <button type="button" data-a="contact"><i>✦</i><span>Contact</span></button>
      <button type="button" data-a="recruiter" class="alt"><i>☰</i><span>Recruiter View</span></button>`;
    const hint = document.createElement('div');
    hint.className = 'drag-hint';
    hint.innerHTML = '<span>DRAG TO ROTATE</span><i></i><span>CLICK A PORTAL</span>';
    const ui_ = $('#ui');
    ui_.append(top, dock, hint);
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      audio.sfx.click(); actions[b.dataset.a]?.();
    });
    dock.addEventListener('pointerenter', () => {}, { passive: true });
    const sb = $('#btn-sound');
    const syncSound = (m) => { sb.textContent = m ? '🔇' : '🔊'; sb.setAttribute('aria-pressed', String(m)); };
    syncSound(audio.muted);
    audio.onMute(syncSound);
    sb.addEventListener('click', () => { audio.toggle(); store.state.muted = audio.muted; store.save(); });
    gsap.set([top, dock, hint], { autoAlpha: 0 });
    return {
      show() { gsap.to([top, dock, hint], { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out' }); },
      hide() { gsap.to([top, dock, hint], { autoAlpha: 0, duration: 0.3 }); },
      hideHint() { gsap.to(hint, { autoAlpha: 0, duration: 0.4 }); },
      update() {
        const lv = store.level;
        $('#lv-n').textContent = lv;
        $('#lv-rank').textContent = rankOf(lv);
        gsap.to('#xp-bar', { scaleX: store.levelProgress, duration: 0.8, ease: 'power3.out' });
        const n = store.state.god ? missions.length : store.clearedCount();
        $('#cl-n').textContent = n;
      },
    };
  },

  toast(msg, ms = 4200) {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast glass';
    t.textContent = msg;
    box.appendChild(t);
    gsap.fromTo(t, { y: 30, opacity: 0, scale: 0.95 }, { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' });
    gsap.to(t, { opacity: 0, y: -10, duration: 0.4, delay: ms / 1000, onComplete: () => t.remove() });
  },

  // ---------- Briefing ----------
  briefing() {
    return new Promise((resolve) => {
      const e = mount(`
        <div class="eyebrow">MISSION BRIEFING</div>
        <h2>Hi, I'm <span class="grad">Saksham</span>.</h2>
        <p class="lead">This isn't a normal portfolio. My story is locked behind <b>10 tiny missions</b>. Each takes 5–10 seconds, and every clear forges a new piece of my <b>Core</b>.</p>
        <ul class="brief">
          <li><i>⟳</i> <span><b>Drag</b> to rotate the system. Scroll to zoom.</span></li>
          <li><i>◎</i> <span><b>Click a glowing portal</b> to warp into a mission.</span></li>
          <li><i>◆</i> <span>Win to unlock a chapter of my journey, plus the <b>skills</b> that came with it.</span></li>
          <li><i>☰</i> <span>In a hurry? <b>Recruiter View</b> (bottom right) gives you everything instantly.</span></li>
        </ul>
        <div class="p-actions"><button class="btn primary big" type="button" id="brief-go">ENTER THE SYSTEM ▸</button></div>`, 'brief', { closable: false });
      $('#brief-go', e.panel).addEventListener('click', () => { audio.sfx.click(); e.close(); resolve(); });
    });
  },

  // ---------- Reveal (story after a mission) ----------
  reveal(m, { bonus = 0, skipped = false, first = true } = {}) {
    return new Promise((resolve) => {
      const skills = m.skills.map((s, i) => `
        <div class="skill" style="--c:${m.color}">
          <div class="sk-h"><span>${s.name}</span><em>${levelName(s.lvl)}</em></div>
          <div class="sk-bar"><i data-w="${s.lvl}"></i></div>
        </div>`).join('');
      const projs = m.projects.length
        ? `<div class="chips">${m.projects.map((p) => `<a class="chip" href="${p.url}" target="_blank" rel="noopener">${p.name} ↗</a>`).join('')}</div>` : '';
      const e = mount(`
        <div class="rv-num" style="--c:${m.color}">${pad(m.n)}</div>
        <div class="eyebrow" style="color:${m.color}">CHAPTER ${pad(m.n)} · ${m.year}${skipped ? ' · SKIPPED' : ''}</div>
        <h2>${m.title}</h2>
        <p class="story" id="rv-story" aria-label="${m.story.replace(/"/g, '&quot;')}"></p>
        <div class="unlock"><span class="tag" style="--c:${m.color}">SKILLS UNLOCKED</span>${first && !skipped ? `<span class="xp-chip">+${120 + bonus} XP</span>` : ''}</div>
        <div class="skills">${skills}</div>
        ${projs}
        <div class="p-actions"><button class="btn primary big" type="button" id="rv-go">CONTINUE ▸</button></div>`, 'reveal', { side: true, closable: false });
      const story = $('#rv-story', e.panel);
      const o = { n: 0 };
      const tw = gsap.to(o, {
        n: m.story.length, duration: m.story.length * 0.011, ease: 'none', delay: 0.5,
        onUpdate: () => { story.textContent = m.story.slice(0, Math.floor(o.n)); if (Math.floor(o.n) % 3 === 0) audio.sfx.key(); },
      });
      story.addEventListener('click', () => { tw.progress(1); });
      const bars = e.panel.querySelectorAll('.sk-bar i');
      bars.forEach((b, i) => gsap.fromTo(b, { scaleX: 0 }, { scaleX: Number(b.dataset.w) / 100, duration: 1.1, delay: 1.0 + i * 0.25, ease: 'expo.out', onStart: () => audio.sfx.coin() }));
      gsap.from(e.panel.querySelectorAll('.skill, .chip, .unlock'), { y: 18, opacity: 0, duration: 0.5, stagger: 0.1, delay: 0.8, ease: 'power3.out' });
      $('#rv-go', e.panel).addEventListener('click', () => { audio.sfx.click(); tw.kill(); e.close(); resolve(); });
    });
  },

  // ---------- Player Card ----------
  card() {
    const cats = categories.map((c) => {
      const all = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id).map((s) => ({ ...s, m })));
      const got = all.filter((s) => unlocked(s.m));
      const potential = all.length ? all.reduce((a, s) => a + s.lvl, 0) / all.length : 0;
      const value = got.length ? got.reduce((a, s) => a + s.lvl, 0) / got.length : 0;
      return { ...c, all, got, potential, value };
    });
    const R = 120, cx = 160, cy = 150;
    const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / cats.length;
    const pt = (i, v) => [cx + Math.cos(ang(i)) * R * (v / 100), cy + Math.sin(ang(i)) * R * (v / 100)];
    const ring = (f) => cats.map((_, i) => pt(i, 100 * f).join(',')).join(' ');
    const axes = cats.map((c, i) => { const [x, y] = pt(i, 100); const [lx, ly] = pt(i, 122); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle">${c.label}</text>`; }).join('');
    const poly = (k) => cats.map((c, i) => pt(i, c[k]).join(',')).join(' ');
    const lv = store.level;
    const e = mount(`
      <div class="eyebrow">PLAYER CARD</div>
      <div class="card-grid">
        <div class="card-l">
          <h2>${profile.name}</h2>
          <div class="rank"><span class="badge">LV ${lv}</span><b>${rankOf(lv)}</b><em>${profile.role}</em></div>
          <svg class="radar" viewBox="0 0 320 300" role="img" aria-label="Skill radar chart">
            <g class="rings">${[0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}"/>`).join('')}</g>
            <g class="axes">${axes}</g>
            <polygon class="potential" points="${poly('potential')}"/>
            <polygon class="value" id="radar-v" points="${cats.map((_, i) => pt(i, 0).join(',')).join(' ')}"/>
          </svg>
          <p class="legend"><i class="a"></i> unlocked <i class="b"></i> potential: clear missions to fill it</p>
          <div class="p-actions row"><button class="btn small" type="button" id="reset-btn">↺ Reset progress</button></div>
        </div>
        <div class="card-r">
          ${cats.map((c) => `
            <div class="cat"><h4>${c.label}</h4>
              <div class="cat-skills">${c.all.map((s) => unlocked(s.m)
                ? `<div class="sk" style="--c:${s.m.color}"><span>${s.name}</span><b>${s.lvl}</b><div class="sk-bar"><i style="transform:scaleX(${s.lvl / 100})"></i></div></div>`
                : `<div class="sk locked"><span>▒▒▒▒▒▒▒▒</span><b>??</b><div class="sk-bar"><i></i></div></div>`).join('')}</div>
            </div>`).join('')}
          <div class="cat"><h4>Certificates & Achievements</h4>
            <ul class="certs">${certs.map((c) => `<li class="${c.hot ? 'hot' : ''}"><b>${c.title}</b><span>${c.sub}</span></li>`).join('')}</ul></div>
        </div>
      </div>`, 'card wide');
    const v = { t: 0 };
    gsap.to(v, { t: 1, duration: 1.4, delay: 0.3, ease: 'expo.out', onUpdate: () => { $('#radar-v', e.panel)?.setAttribute('points', cats.map((c, i) => pt(i, c.value * v.t).join(',')).join(' ')); } });
    $('#reset-btn', e.panel).addEventListener('click', () => { if (confirm('Reset all mission progress?')) { store.reset(); location.reload(); } });
    return e;
  },

  // ---------- Project Vault ----------
  vault() {
    const e = mount(`
      <div class="eyebrow">PROJECT VAULT</div>
      <h2>Things I've built</h2>
      <p class="sub">Hover the cartridges. Click to open the repo.</p>
      <div class="vault-grid">${projects.map((p, i) => `
        <a class="vcard" href="${p.url}" target="_blank" rel="noopener" style="--c:${p.color};--i:${i}">
          <div class="v-glare"></div>
          <div class="v-in">
            <span class="v-tag">${p.tag}</span>
            <h3>${p.name}</h3>
            <p>${p.blurb}</p>
            <span class="v-go">OPEN REPO ↗</span>
          </div>
        </a>`).join('')}</div>`, 'vault wide');
    const cards = e.panel.querySelectorAll('.vcard');
    gsap.from(cards, { y: 40, opacity: 0, rotateX: -25, duration: 0.7, stagger: 0.05, delay: 0.25, ease: 'power3.out' });
    cards.forEach((c) => {
      c.addEventListener('pointermove', (ev) => {
        const r = c.getBoundingClientRect();
        const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        c.style.setProperty('--rx', ((0.5 - y) * 16).toFixed(2) + 'deg');
        c.style.setProperty('--ry', ((x - 0.5) * 20).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        c.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      c.addEventListener('pointerenter', () => audio.sfx.hover());
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
    return e;
  },

  // ---------- Contact ----------
  contact() {
    const e = mount(`
      <div class="eyebrow">OPEN CHANNEL</div>
      <h2>Let's build <span class="grad">something</span>.</h2>
      <p class="lead">${profile.status}: internships, collabs, and hackathon teams. I reply fast.</p>
      <div class="contact-grid">
        <a class="c-btn primary" href="mailto:${profile.email}"><i>✉</i><span><b>Email</b>${profile.email}</span></a>
        <button class="c-btn" type="button" id="copy-mail"><i>⧉</i><span><b>Copy email</b>one click, no typos</span></button>
        <a class="c-btn" href="${profile.linkedin}" target="_blank" rel="noopener"><i>in</i><span><b>LinkedIn</b>saksham-sharma-14sept</span></a>
        <a class="c-btn" href="${profile.github}" target="_blank" rel="noopener"><i>⌥</i><span><b>GitHub</b>sammy-master</span></a>
        <a class="c-btn" href="${profile.resume}" download><i>⇩</i><span><b>Résumé</b>PDF download</span></a>
      </div>`, 'contact');
    $('#copy-mail', e.panel).addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(profile.email); ui.toast('Email copied to clipboard ✓'); audio.sfx.coin(); }
      catch { ui.toast(profile.email); }
    });
    gsap.from(e.panel.querySelectorAll('.c-btn'), { y: 20, opacity: 0, duration: 0.5, stagger: 0.07, delay: 0.3, ease: 'power3.out' });
    return e;
  },

  // ---------- Recruiter view (accessible, plain, instant) ----------
  recruiter() {
    const skillsByCat = categories.map((c) => {
      const list = missions.flatMap((m) => m.skills.filter((s) => s.cat === c.id));
      return `<section><h3>${c.label}</h3><ul class="r-skills">${list.map((s) => `<li><span>${s.name}</span><em>${levelName(s.lvl)}</em></li>`).join('')}</ul></section>`;
    }).join('');
    const e = mount(`
      <div class="eyebrow">RECRUITER VIEW</div>
      <h2>${profile.name}</h2>
      <p class="lead">${profile.role} · ${profile.school} · ${profile.batch}<br><b>${profile.status}</b></p>
      <p>${profile.bio}</p>
      <div class="r-links">
        <a class="btn primary" href="mailto:${profile.email}">Email</a>
        <a class="btn" href="${profile.resume}" download>Résumé (PDF)</a>
        <a class="btn" href="${profile.github}" target="_blank" rel="noopener">GitHub</a>
        <a class="btn" href="${profile.linkedin}" target="_blank" rel="noopener">LinkedIn</a>
      </div>
      <h3 class="r-h">Journey</h3>
      <ol class="r-journey">${missions.map((m) => `<li><b>${m.year} · ${m.title}</b><p>${m.story}</p></li>`).join('')}</ol>
      <h3 class="r-h">Skills</h3>
      <div class="r-cols">${skillsByCat}</div>
      <h3 class="r-h">Projects</h3>
      <ul class="r-proj">${projects.map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a><span>${p.blurb}</span></li>`).join('')}</ul>
      <h3 class="r-h">Certificates & Achievements</h3>
      <ul class="r-proj">${certs.map((c) => `<li><b>${c.title}</b><span>${c.sub}</span></li>`).join('')}</ul>`, 'recruiter wide');
    return e;
  },

  // ---------- Finale ----------
  finale(actions) {
    const e = mount(`
      <div class="eyebrow">ALL MISSIONS CLEARED</div>
      <h2>Core <span class="grad">complete</span>.</h2>
      <p class="lead">That's the whole story: from a first <code>printf</code> to hackathon boss fights. If you made it here, we should probably talk.</p>
      <div class="p-actions"><button class="btn primary big" type="button" data-a="contact">LET'S TALK ▸</button><button class="btn big" type="button" data-a="card">SEE MY STATS</button><button class="btn big" type="button" data-a="vault">BROWSE PROJECTS</button></div>`, 'finale');
    e.panel.addEventListener('click', (ev) => { const b = ev.target.closest('[data-a]'); if (b) { e.close(); setTimeout(() => actions[b.dataset.a]?.(), 350); } });
    return e;
  },
};
