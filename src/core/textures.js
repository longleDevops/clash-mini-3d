import * as THREE from 'three';

// Procedural canvas textures (no image files needed, so the game ships as one page).
const cache = new Map();

function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export const glowTexture = () =>
  canvasTexture('glow', 128, 128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.22, 'rgba(255,255,255,0.8)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.2)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });

export const sparkTexture = () =>
  canvasTexture('spark', 128, 128, (g, s) => {
    const c = s / 2;
    const glow = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? c * 0.95 : c * 0.14;
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });

export const flameTexture = () =>
  canvasTexture('flame', 128, 192, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h * 0.68, 2, w / 2, h * 0.62, w * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(w / 2, 4);
    g.bezierCurveTo(w * 0.62, h * 0.3, w * 0.98, h * 0.5, w * 0.86, h * 0.76);
    g.bezierCurveTo(w * 0.76, h * 0.98, w * 0.24, h * 0.98, w * 0.14, h * 0.76);
    g.bezierCurveTo(w * 0.02, h * 0.5, w * 0.4, h * 0.3, w / 2, 4);
    g.fill();
  });

export const ringTexture = () =>
  canvasTexture('ring', 256, 256, (g, s) => {
    const c = s / 2;
    const r = g.createRadialGradient(c, c, c * 0.55, c, c, c);
    r.addColorStop(0, 'rgba(255,255,255,0)');
    r.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    r.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  });

/** Vertical gradient for scene backgrounds. stops: [[0,'#hex'], [1,'#hex']] (0 = top). */
export function gradientTexture(key, stops, h = 512) {
  return canvasTexture('grad:' + key, 4, h, (g, w, hh) => {
    const lg = g.createLinearGradient(0, 0, 0, hh);
    for (const [t, col] of stops) lg.addColorStop(t, col);
    g.fillStyle = lg;
    g.fillRect(0, 0, w, hh);
  });
}
