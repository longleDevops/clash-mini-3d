// Extra icons for the hub, world map and chapter map (same chunky outlined style as icons.js).
const S = (body, vb = '0 0 64 64') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const OUT = 'stroke="#2B2540" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';

export const SCENE_ICONS = {
  summon: S(`<circle cx="32" cy="32" r="25" fill="#9b5cff" ${OUT}/><path d="M32 16c10 0 16 7 16 15s-7 13-14 13-11-5-11-10 4-8 8-8 7 3 7 6" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="12" r="3" fill="#ffd45c"/>`),
  arena: S(`<ellipse cx="32" cy="40" rx="26" ry="14" fill="#e4dcf4" ${OUT}/><path d="M6 40V28c0-8 12-14 26-14s26 6 26 14v12" fill="#c6bce6" ${OUT}/><ellipse cx="32" cy="28" rx="18" ry="8" fill="#f0d9a8" ${OUT}/><path d="M14 34v6M24 37v6M40 37v6M50 34v6" stroke="#2B2540" stroke-width="3"/>`),
  map: S(`<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6Z" fill="#fff3d6" ${OUT}/><path d="M22 8v42M42 14v42" stroke="#2B2540" stroke-width="3"/><path d="M12 36c6-2 8-10 16-8s8 10 16 6" fill="none" stroke="#ff6e8a" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/><circle cx="46" cy="30" r="4" fill="#ff6e8a" ${OUT} stroke-width="2.5"/>`),
  boss: S(`<path d="M12 30c0-12 9-20 20-20s20 8 20 20c0 8-4 12-8 14v8H20v-8c-4-2-8-6-8-14Z" fill="#5b4796" ${OUT}/><path d="M14 18 8 6l12 6M50 18l6-12-12 6" fill="#ffb35c" ${OUT}/><path d="M20 30l8 3M44 30l-8 3" stroke="#ffd45c" stroke-width="5" stroke-linecap="round"/><path d="M26 44h12" stroke="#2B2540" stroke-width="3"/>`),
  flag: S(`<path d="M16 6v52" ${OUT}/><path d="M18 8h30l-6 10 6 10H18Z" fill="#ff6e8a" ${OUT}/>`),
  castle: S(`<path d="M8 56V26l8-6 8 6v8h16v-8l8-6 8 6v30Z" fill="#e8ecff" ${OUT}/><path d="M8 26l8-14 8 14M40 26l8-14 8 14" fill="#7fb2ff" ${OUT}/><path d="M26 56V44a6 6 0 0 1 12 0v12" fill="#c57cff" ${OUT}/>`),
};
