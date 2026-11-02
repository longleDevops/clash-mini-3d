// Which body each hero wears (code-built or a Blender GLB), remembered per viewer.
// Storage can be unavailable (private windows, previews), so every access is guarded.
const KEY = 'skyward-minis:bodies';
let picks = {};
try {
  picks = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
} catch {
  /* storage unavailable */
}

export const BODY_LABELS = { code: 'Code', blender: 'Blender', generated: 'Generated' };

export const bodyChoice = {
  get(id, fallback) {
    return picks[id] ?? fallback;
  },
  set(id, value) {
    picks[id] = value;
    try {
      localStorage.setItem(KEY, JSON.stringify(picks));
    } catch {
      /* storage unavailable */
    }
  },
};
