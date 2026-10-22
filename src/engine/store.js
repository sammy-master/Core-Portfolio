const KEY = 'core-portfolio-save-v2';
const defaults = {
  cleared: {},
  xp: 0,
  muted: false,
  god: false,
  intro: false,
  difficulty: 'normal', // 'chill' | 'normal' | 'pro'
  worldMode: 'orrery',  // 'orrery' | 'drive' | 'shooter'
};
let state = { ...defaults };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...defaults, ...JSON.parse(raw) };
} catch { /* storage unavailable */ }

export const DIFFICULTIES = {
  chill: { label: 'CHILL', timeMult: 1.65, penaltyMult: 0, speedMult: 0.72, xpMult: 1.0, desc: 'Relaxed timer (+65% time), zero penalties, forgiving targets' },
  normal: { label: 'NORMAL', timeMult: 1.15, penaltyMult: 0.75, speedMult: 0.92, xpMult: 1.25, desc: 'Balanced pace with clear visual hints & forgiving controls' },
  pro: { label: 'PRO', timeMult: 0.9, penaltyMult: 1.1, speedMult: 1.15, xpMult: 1.6, desc: 'Fast esports reflexes & bonus 1.6× XP multiplier' },
};

export const store = {
  get state() { return state; },
  get diff() { return DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal; },
  setDifficulty(d) {
    if (DIFFICULTIES[d]) { state.difficulty = d; this.save(); }
  },
  setWorldMode(m) {
    state.worldMode = m; this.save();
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } },
  isCleared(id) { return !!state.cleared[id]; },
  clearedCount() { return Object.keys(state.cleared).length; },
  markCleared(id, skipped, bonus) {
    const first = !state.cleared[id];
    const mult = this.diff.xpMult;
    if (first) state.xp += skipped ? 50 : Math.round((130 + bonus) * mult);
    state.cleared[id] = { skipped: !!skipped, t: Date.now() };
    this.save();
    return first;
  },
  get level() { return Math.floor(state.xp / 150) + 1; },
  get levelProgress() { return (state.xp % 150) / 150; },
  reset() { state = { ...defaults, muted: state.muted }; this.save(); },
};
