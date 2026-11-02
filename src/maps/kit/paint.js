import * as THREE from 'three';
import { seeded } from '../../core/math.js';

// Procedural canvas textures for maps (floors, banners, water, emblems).
// Cached by key so re-entering a screen doesn't repaint.
const cache = new Map();

export function paint(key, w, h, draw, { repeat, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
  }
  cache.set(key, tex);
  return tex;
}

/** Shift a #rrggbb colour's lightness by k (-1..1). */
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = k < 0 ? 0 : 255, p = Math.abs(k);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r},${g},${b})`;
}

function annulus(g, cx, cy, r0, r1, a0, a1) {
  g.beginPath();
  g.arc(cx, cy, r1, a0, a1);
  g.arc(cx, cy, r0, a1, a0, true);
  g.closePath();
}

/**
 * Circular plaza of flagstones laid in rings around a centre medallion.
 * o: { stones: [hex...], grout, rings, medal: hex, emblem: fn(g, cx, cy, r), cracks: hex, snow: bool, seed }
 */
export function plazaTexture(key, o) {
  return paint(key, 1024, 1024, (g, S) => {
    const rnd = seeded(o.seed || 3);
    const c = S / 2;
    g.fillStyle = o.grout;
    g.fillRect(0, 0, S, S);
    const medal = S * 0.085;
    const rings = o.rings || 9;
    const rw = (c - medal) / rings;
    const gap = S * 0.0045;
    for (let i = 0; i < rings; i++) {
      const r0 = medal + i * rw + gap, r1 = medal + (i + 1) * rw - gap;
      const n = Math.max(6, Math.round((2 * Math.PI * (r0 + r1)) / 2 / (rw * (1.25 + rnd() * 0.3))));
      const off = rnd() * Math.PI * 2;
      for (let k = 0; k < n; k++) {
        const a0 = off + (k / n) * Math.PI * 2 + gap / r1, a1 = off + ((k + 1) / n) * Math.PI * 2 - gap / r1;
        const base = o.stones[Math.floor(rnd() * o.stones.length)];
        annulus(g, c, c, r0, r1, a0, a1);
        g.fillStyle = shade(base, (rnd() - 0.5) * 0.12);
        g.fill();
        // bevel: light on the outer edge, shadow on the inner edge
        g.save();
        g.clip();
        g.lineWidth = 5;
        g.strokeStyle = 'rgba(255,255,255,0.22)';
        g.beginPath();
        g.arc(c, c, r1 - 1, a0, a1);
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.16)';
        g.beginPath();
        g.arc(c, c, r0 + 1, a0, a1);
        g.stroke();
        g.restore();
      }
    }
    // medallion
    g.fillStyle = o.grout;
    g.beginPath();
    g.arc(c, c, medal + gap, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = o.medal || o.stones[0];
    g.beginPath();
    g.arc(c, c, medal - gap, 0, Math.PI * 2);
    g.fill();
    o.emblem?.(g, c, c, medal * 1.3, rnd);
    if (o.cracks) drawCracks(g, S, o.cracks, rnd, 26);
    if (o.snow) drawSnow(g, S, rnd, 40);
    if (o.moss) drawMoss(g, S, o.moss, rnd, 60);
  });
}

/** Emissive-only copy of the plaza cracks (black elsewhere) for lava glow. */
export function crackGlowTexture(key, color, seed = 3) {
  return paint(key, 1024, 1024, (g, S) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, S, S);
    drawCracks(g, S, color, seeded(seed + 101), 26, true);
  });
}

function drawCracks(g, S, color, rnd, n, glow = false) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < n; i++) {
    let a = rnd() * Math.PI * 2;
    let r = S * (0.12 + rnd() * 0.3);
    let x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
    const pts = [[x, y]];
    const len = 4 + Math.floor(rnd() * 6);
    for (let k = 0; k < len; k++) {
      a += (rnd() - 0.5) * 1.4;
      x += Math.cos(a) * S * 0.025;
      y += Math.sin(a) * S * 0.025;
      pts.push([x, y]);
    }
    for (const [lw, alpha] of glow ? [[14, 0.25], [7, 0.6], [3, 1]] : [[5, 0.9]]) {
      g.strokeStyle = color;
      g.globalAlpha = alpha;
      g.lineWidth = lw;
      g.beginPath();
      pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.stroke();
    }
  }
  g.restore();
}

function drawSnow(g, S, rnd, n) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = rnd() * S, y = rnd() * S, r = S * (0.02 + rnd() * 0.05);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, r * 1.4, r, rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function drawMoss(g, S, color, rnd, n) {
  g.save();
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = S * (0.25 + rnd() * 0.25);
    const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr;
    g.globalAlpha = 0.25 + rnd() * 0.3;
    g.beginPath();
    g.ellipse(x, y, S * (0.01 + rnd() * 0.03), S * (0.008 + rnd() * 0.02), rnd() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Mottled ground (grass / snow / basalt) that tiles. */
export function groundTexture(key, base, spots, { repeat = [6, 6], seed = 5, n = 220, blades = null } = {}) {
  return paint(
    key,
    512,
    512,
    (g, S) => {
      const rnd = seeded(seed);
      g.fillStyle = base;
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < n; i++) {
        const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 26;
        g.globalAlpha = 0.18 + rnd() * 0.25;
        g.fillStyle = spots[Math.floor(rnd() * spots.length)];
        for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
          g.beginPath();
          g.ellipse(x + dx, y + dy, r, r * 0.7, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (blades) {
        g.strokeStyle = blades;
        g.lineWidth = 2;
        g.lineCap = 'round';
        for (let i = 0; i < 500; i++) {
          const x = rnd() * S, y = rnd() * S;
          g.globalAlpha = 0.3 + rnd() * 0.3;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (rnd() - 0.5) * 4, y - 5 - rnd() * 6);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
    },
    { repeat }
  );
}

/** Grass arena oval: lighter mown rings with soft stripes (Forest Grove). */
export function lawnTexture(key, o) {
  return paint(key, 1024, 1024, (g, S) => {
    const rnd = seeded(o.seed || 9);
    const c = S / 2;
    g.fillStyle = o.base;
    g.fillRect(0, 0, S, S);
    for (let i = 10; i > 0; i--) {
      g.fillStyle = i % 2 ? o.light : o.base;
      g.beginPath();
      g.arc(c, c, (c * i) / 10, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * c;
      const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.globalAlpha = 0.25;
      g.fillStyle = rnd() > 0.5 ? o.dark : o.light;
      g.beginPath();
      g.ellipse(x, y, 4 + rnd() * 10, 3 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    o.emblem?.(g, c, c, S * 0.11, rnd);
  });
}

/**
 * Banner cloth with a swallow-tail cut (alpha), gold trim and an emblem.
 * emblem: 'star' | 'swords' | 'flame' | 'leaf' | 'snow' | 'crown' | 'gem' | 'moon'
 */
export function bannerTexture(color, emblem = 'star', trim = '#ffd45c') {
  return paint(`banner:${color}:${emblem}:${trim}`, 128, 256, (g, w, h) => {
    const cut = 44;
    const shape = () => {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(w, 0);
      g.lineTo(w, h);
      g.lineTo(w / 2, h - cut);
      g.lineTo(0, h);
      g.closePath();
    };
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, shade(color, -0.18));
    lg.addColorStop(0.5, shade(color, 0.08));
    lg.addColorStop(1, shade(color, -0.22));
    shape();
    g.fillStyle = lg;
    g.fill();
    g.save();
    shape();
    g.clip();
    g.strokeStyle = trim;
    g.lineWidth = 14;
    shape();
    g.stroke();
    g.fillStyle = trim;
    g.fillRect(0, 0, w, 22);
    g.restore();
    drawEmblem(g, emblem, w / 2, h * 0.42, 34, trim);
  });
}

export function drawEmblem(g, kind, x, y, r, color = '#ffd45c', ink = '#2b2540') {
  g.save();
  g.translate(x, y);
  g.fillStyle = color;
  g.strokeStyle = ink;
  g.lineWidth = r * 0.14;
  g.lineJoin = 'round';
  g.beginPath();
  if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else if (kind === 'compass') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.26 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
  } else if (kind === 'swords') {
    g.rotate(Math.PI / 4);
    g.rect(-r * 0.12, -r, r * 0.24, r * 1.6);
    g.rect(-r * 0.4, r * 0.45, r * 0.8, r * 0.16);
    g.rotate(-Math.PI / 2);
    g.rect(-r * 0.12, -r, r * 0.24, r * 1.6);
    g.rect(-r * 0.4, r * 0.45, r * 0.8, r * 0.16);
  } else if (kind === 'flame') {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.5, -r * 0.3, r * 0.9, 0, r * 0.7, r * 0.5);
    g.bezierCurveTo(r * 0.5, r, -r * 0.5, r, -r * 0.7, r * 0.5);
    g.bezierCurveTo(-r * 0.9, 0, -r * 0.2, -r * 0.3, 0, -r);
  } else if (kind === 'leaf') {
    g.moveTo(0, -r);
    g.quadraticCurveTo(r * 0.95, -r * 0.1, 0, r);
    g.quadraticCurveTo(-r * 0.95, -r * 0.1, 0, -r);
  } else if (kind === 'snow') {
    for (let i = 0; i < 6; i++) {
      g.save();
      g.rotate((i / 6) * Math.PI * 2);
      g.rect(-r * 0.09, -r, r * 0.18, r);
      g.rect(-r * 0.32, -r * 0.72, r * 0.64, r * 0.13);
      g.restore();
    }
  } else if (kind === 'crown') {
    g.moveTo(-r, r * 0.5);
    g.lineTo(-r, -r * 0.4);
    g.lineTo(-r * 0.5, 0);
    g.lineTo(0, -r * 0.7);
    g.lineTo(r * 0.5, 0);
    g.lineTo(r, -r * 0.4);
    g.lineTo(r, r * 0.5);
  } else if (kind === 'gem') {
    g.moveTo(0, -r);
    g.lineTo(r * 0.7, -r * 0.2);
    g.lineTo(0, r);
    g.lineTo(-r * 0.7, -r * 0.2);
  } else if (kind === 'moon') {
    g.arc(0, 0, r * 0.8, Math.PI * 0.25, Math.PI * 1.75);
    g.arc(r * 0.35, -r * 0.1, r * 0.6, Math.PI * 1.6, Math.PI * 0.4, true);
  }
  g.closePath();
  g.stroke();
  g.fill();
  g.restore();
}

/** Ring + emblem painted at a plaza centre. */
export function medallion(kind, fill, ring) {
  return (g, cx, cy, r) => {
    g.save();
    g.strokeStyle = ring;
    g.globalAlpha = 0.9;
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
    g.stroke();
    g.restore();
    drawEmblem(g, kind, cx, cy, r * 0.62, fill, 'rgba(43,37,64,0.55)');
  };
}

/** Vertical streaks for waterfalls / lava falls; scroll texture.offset.y to animate. */
export function streakTexture(key, colors) {
  return paint(
    key,
    64,
    256,
    (g, w, h) => {
      const rnd = seeded(11);
      g.fillStyle = colors[0];
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = colors[1 + Math.floor(rnd() * (colors.length - 1))];
        g.globalAlpha = 0.4 + rnd() * 0.5;
        g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 20 + rnd() * 60);
      }
    },
    { repeat: [1, 1] }
  );
}

/** Soft round particle sprite. */
export function dotTexture() {
  return paint('dot', 64, 64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

export function snowflakeTexture() {
  return paint('snowflake', 64, 64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    r.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });
}

export function petalTexture() {
  return paint('petal', 64, 64, (g, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.42, s * 0.22, 0.6, 0, Math.PI * 2);
    g.fill();
  });
}

/** Swirling portal disc (summon gate, forge portal). */
export function swirlTexture(key, inner, outer) {
  return paint(key, 256, 256, (g, s) => {
    const c = s / 2;
    const rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, inner);
    rg.addColorStop(0.7, outer);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      g.lineWidth = 6 - k;
      g.beginPath();
      for (let i = 0; i < 80; i++) {
        const t = i / 80, a = t * Math.PI * 3 + (k * Math.PI) / 2, r = t * c * 0.85;
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.stroke();
    }
  });
}

/** Molten lava (tiling); use as map + emissiveMap and scroll the offset. */
export function lavaTexture() {
  return paint(
    'lava',
    256,
    256,
    (g, S) => {
      const rnd = seeded(41);
      g.fillStyle = '#ff5a1f';
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 140; i++) {
        const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 28;
        g.globalAlpha = 0.35 + rnd() * 0.4;
        g.fillStyle = rnd() > 0.55 ? '#ffd23f' : rnd() > 0.5 ? '#c2281a' : '#ff8a2a';
        for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
          g.beginPath();
          g.ellipse(x + dx, y + dy, r, r * 0.6, rnd() * 3, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    },
    { repeat: [10, 10] }
  );
}
