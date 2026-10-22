const KEY = 'core-portfolio-save-v1';
const defaults = { cleared: {}, xp: 0, muted: false, god: false, intro: false };
let state = { ...defaults };

try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = { ...defaults, ...JSON.parse(raw) };
} catch { /* storage unavailable */ }

export const store = {
  get state() { return state; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } },
  isCleared(id) { return !!state.cleared[id]; },
  clearedCount() { return Object.keys(state.cleared).length; },
  markCleared(id, skipped, bonus) {
    const first = !state.cleared[id];
    if (first) state.xp += skipped ? 40 : 120 + bonus;
    state.cleared[id] = { skipped: !!skipped, t: Date.now() };
    this.save();
    return first;
  },
  get level() { return Math.floor(state.xp / 150) + 1; },
  get levelProgress() { return (state.xp % 150) / 150; },
  reset() { state = { ...defaults, muted: state.muted }; this.save(); },
};
