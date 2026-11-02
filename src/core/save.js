// Per-viewer progress (stage, currencies). Storage can be unavailable (private
// windows, previews), so every access is guarded and the game works without it.
const KEY = 'skyward-minis:v1';
const DEFAULTS = { stage: 1, gems: 120, gold: 2500, wins: 0, bestStars: {} };

export class Save {
  constructor() {
    this.data = { ...DEFAULTS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* storage unavailable */
    }
  }

  set(patch) {
    Object.assign(this.data, patch);
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable */
    }
  }
}
