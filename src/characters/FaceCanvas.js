import * as THREE from 'three';

/**
 * Painted face texture with swappable expressions. Each hero supplies a
 * draw(ctx, size, expression, blink) function; the texture redraws only
 * when the expression or blink state changes.
 */
export class FaceCanvas {
  constructor(draw, { size = 512, initial = 'neutral' } = {}) {
    this.draw = draw;
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.texture.userData.owned = true;
    this.expression = initial;
    this.blink = false;
    this.redraw();
  }

  set(expression) {
    if (expression === this.expression) return;
    this.expression = expression;
    this.redraw();
  }

  setBlink(b) {
    if (b === this.blink) return;
    this.blink = b;
    this.redraw();
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.size, this.size);
    this.draw(this.ctx, this.size, this.expression, this.blink);
    this.texture.needsUpdate = true;
  }
}

// ---- Shared face painting helpers (coordinates on a 512 canvas) ----
export const facePaint = {
  ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  },
  /** Big glossy anime eye. */
  eye(ctx, x, y, { rx = 30, ry = 44, top = '#1d1631', bottom = '#5a3f96', shine = '#ffffff', squint = 0 } = {}) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, top);
    g.addColorStop(0.6, top);
    g.addColorStop(1, bottom);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.28, y - ry * 0.36, rx * 0.36, ry * 0.26, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(x + rx * 0.34, y + ry * 0.34, rx * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (squint) {
      // lid cut (angry/sad): squint>0 cuts inner-top, <0 cuts outer-top
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      const dir = Math.sign(squint);
      ctx.moveTo(x - rx * 1.4, y - ry * (0.15 + 0.6 * (dir > 0 ? 1 : 0.2)));
      ctx.lineTo(x + rx * 1.4, y - ry * (0.15 + 0.6 * (dir > 0 ? 0.2 : 1)));
      ctx.lineTo(x + rx * 1.4, y - ry * 2);
      ctx.lineTo(x - rx * 1.4, y - ry * 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  },
  /** Closed eye arc. up=true draws ^ (happy), false draws ‿ (sleepy/blink). */
  closedEye(ctx, x, y, { w = 30, up = true, color = '#2B2540', lw = 9 } = {}) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (up) ctx.arc(x, y + w * 0.55, w, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(x, y - w * 0.55, w, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  },
  stroke(ctx, pts, { color = '#2B2540', lw = 7 } = {}) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.restore();
  },
  smile(ctx, x, y, w, { color = '#7a3046', lw = 6, depth = 0.5 } = {}) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y + w * depth, x + w / 2, y);
    ctx.stroke();
    ctx.restore();
  },
  openMouth(ctx, x, y, w, h, { tongue = true } = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y - h * 0.15, x + w / 2, y);
    ctx.quadraticCurveTo(x + w * 0.45, y + h, x, y + h);
    ctx.quadraticCurveTo(x - w * 0.45, y + h, x - w / 2, y);
    ctx.closePath();
    ctx.fillStyle = '#7a2843';
    ctx.fill();
    ctx.clip();
    if (tongue) {
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.95, w * 0.32, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};
