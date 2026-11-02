// Inline SVG icons in the kit's chunky style (outlined, glossy fills).
const S = (body, vb = '0 0 64 64') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const OUT = 'stroke="#2B2540" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';

export const ICONS = {
  gem: S(`<path d="M32 5 54 22 32 59 10 22Z" fill="#a66bff" ${OUT}/><path d="M32 5 41 22 32 59 23 22Z" fill="#c99bff"/><path d="M10 22h44" stroke="#2B2540" stroke-width="3"/><path d="M24 14l6-5" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`),
  coin: S(`<circle cx="32" cy="32" r="24" fill="#ffd45c" ${OUT}/><circle cx="32" cy="32" r="16" fill="#f5b52e" stroke="#c9861a" stroke-width="3"/><path d="M24 22c4-5 12-5 16 0" stroke="#fff6c7" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  bolt: S(`<path d="M36 4 14 36h14l-4 24 26-36H36Z" fill="#ffd45c" ${OUT}/><path d="M33 10 22 30" stroke="#fff6c7" stroke-width="3" stroke-linecap="round"/>`),
  swords: S(`<path d="M10 8l30 30-6 6L4 14V8Z" fill="#e8ecff" ${OUT}/><path d="M54 8 24 38l6 6 30-30V8Z" fill="#e8ecff" ${OUT}/><path d="M14 42l8 8M50 42l-8 8" ${OUT}/><rect x="8" y="46" width="12" height="8" rx="2" transform="rotate(-45 14 50)" fill="#ffd45c" ${OUT}/><rect x="44" y="46" width="12" height="8" rx="2" transform="rotate(45 50 50)" fill="#ffd45c" ${OUT}/>`),
  mage: S(`<circle cx="32" cy="32" r="25" fill="#9b5cff" ${OUT}/><path d="M32 18c9 0 14 6 14 13s-6 11-12 11-9-4-9-8 3-6 7-6 5 2 5 4" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
  arcane: S(`<circle cx="32" cy="32" r="25" fill="#ff6eb4" ${OUT}/><path d="M32 13l5 12 13 2-10 8 3 13-11-7-11 7 3-13-10-8 13-2Z" fill="#fff"/>`),
  back: S(`<path d="M40 12 18 32l22 20" fill="none" stroke="#2B2540" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 12 18 32l22 20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  pause: S(`<rect x="15" y="12" width="12" height="40" rx="4" fill="#fff" ${OUT}/><rect x="37" y="12" width="12" height="40" rx="4" fill="#fff" ${OUT}/>`),
  play: S(`<path d="M18 10v44l36-22Z" fill="#fff" ${OUT}/>`),
  home: S(`<path d="M8 30 32 10l24 20v24H40V40H24v14H8Z" fill="#7fb2ff" ${OUT}/><path d="M24 54V40h16v14" fill="#ffd45c" ${OUT}/>`),
  heroes: S(`<circle cx="32" cy="22" r="12" fill="#ffd8bf" ${OUT}/><path d="M12 56c2-12 10-18 20-18s18 6 20 18Z" fill="#c57cff" ${OUT}/><path d="M20 18c2-8 22-8 24 0-8-3-16-3-24 0Z" fill="#46336f" ${OUT}/>`),
  guild: S(`<path d="M32 6 54 14v16c0 14-10 22-22 28C20 52 10 44 10 30V14Z" fill="#7fb2ff" ${OUT}/><path d="M22 30l6-8 4 6 4-6 6 8v8H22Z" fill="#ffd45c" ${OUT}/>`),
  shop: S(`<path d="M10 26h44v28H10Z" fill="#fff3e0" ${OUT}/><path d="M6 26 12 10h40l6 16Z" fill="#ff6e8a" ${OUT}/><path d="M22 10l-4 16M32 10v16M42 10l4 16" stroke="#fff" stroke-width="3"/><rect x="26" y="36" width="12" height="18" fill="#c57cff" ${OUT}/>`),
  lock: S(`<rect x="14" y="28" width="36" height="28" rx="6" fill="#ffd45c" ${OUT}/><path d="M22 28v-8a10 10 0 0 1 20 0v8" fill="none" ${OUT}/>`),
  star: S(`<path d="M32 5l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2Z" fill="#ffd45c" ${OUT}/><path d="M24 20l5-1" stroke="#fff6c7" stroke-width="3" stroke-linecap="round"/>`),
  starEmpty: S(`<path d="M32 5l8 17 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2Z" fill="#5a4aa0" ${OUT}/>`),
  chest: S(`<path d="M8 28h48v26H8Z" fill="#c9862b" ${OUT}/><path d="M8 28c0-12 10-18 24-18s24 6 24 18Z" fill="#e8a43a" ${OUT}/><rect x="27" y="30" width="10" height="12" rx="2" fill="#ffd45c" ${OUT}/>`),
  exp: S(`<rect x="6" y="14" width="52" height="36" rx="8" fill="#c57cff" ${OUT}/><text x="32" y="40" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="20" fill="#fff" stroke="#2B2540" stroke-width="1">EXP</text>`),
  rotate: S(`<path d="M50 30a18 18 0 1 1-6-13" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M46 6v14H32" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`),
  // skill icons
  orb: S(`<defs><radialGradient id="go" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#e2b8ff"/><stop offset="1" stop-color="#7b3fe0"/></radialGradient></defs><circle cx="32" cy="32" r="20" fill="url(#go)" ${OUT}/><path d="M32 18c8 0 12 6 11 12" stroke="#fff" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="48" cy="14" r="3" fill="#fff"/><circle cx="14" cy="48" r="2.5" fill="#fff"/>`),
  foxfire: S(`<path d="M32 6c4 10 16 16 16 30a16 16 0 0 1-32 0c0-8 5-12 8-18 2 6 5 8 8 8-2-8-2-14 0-20Z" fill="#ff6eb4" ${OUT}/><path d="M32 30c3 5 8 7 8 13a8 8 0 0 1-16 0c0-4 3-6 4-9 1 3 3 4 4 4Z" fill="#ffe3f4"/><circle cx="50" cy="12" r="3" fill="#c57cff"/>`),
  starfall: S(`<path d="M44 6a20 20 0 1 0 14 30A16 16 0 1 1 44 6Z" fill="#ffd45c" ${OUT}/><path d="M18 34l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z" fill="#fff" ${OUT} stroke-width="2.5"/><circle cx="30" cy="16" r="2.5" fill="#fff"/>`),
  bells: S(`<path d="M20 14h24l4 26H16Z" fill="#ffd45c" ${OUT}/><path d="M12 40h40v6H12Z" fill="#e6a42a" ${OUT}/><circle cx="32" cy="52" r="5" fill="#e6a42a" ${OUT}/><path d="M32 6v8" ${OUT}/><path d="M24 20c1 6 1 12 0 16" stroke="#fff6c7" stroke-width="3" stroke-linecap="round"/>`),
  claw: S(`<path d="M14 50 30 10M26 54 42 14M38 56 52 22" stroke="#9b7bff" stroke-width="7" stroke-linecap="round"/><path d="M14 50 30 10M26 54 42 14M38 56 52 22" stroke="#2B2540" stroke-width="2" stroke-linecap="round" opacity=".6"/>`),
};
