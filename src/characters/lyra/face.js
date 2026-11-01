import { facePaint as F } from '../FaceCanvas.js';
import { LYRA_PALETTE as P, LYRA_HEAD as HEAD } from './palette.js';

// Lyra's expressions, from the "Expressions (Face Variants)" block of the sheet.
export const LYRA_EXPRESSIONS = ['neutral', 'happy', 'surprised', 'angry', 'wink', 'laugh', 'sad', 'sleepy'];

/**
 * The head's front face is planar-UV-mapped, so we lay the face out in head
 * units (origin = head centre, +y up) and convert to canvas pixels.
 */
export function drawLyraFace(ctx, S, expr, blink) {
  const X = (u) => (u / HEAD.w + 0.5) * S;
  const Y = (v) => (0.5 - v / HEAD.h) * S;
  const k = S / HEAD.w; // px per unit (x)

  ctx.fillStyle = P.skin;
  ctx.fillRect(0, 0, S, S);

  // soft cheek blush
  for (const sx of [-1, 1]) {
    const g = ctx.createRadialGradient(X(sx * 12.5), Y(-7.6), 2, X(sx * 12.5), Y(-7.6), 4.6 * k);
    g.addColorStop(0, 'rgba(255,110,170,0.55)');
    g.addColorStop(1, 'rgba(255,110,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  const eyeY = Y(-3.2), eyeL = X(-8.6), eyeR = X(8.6);
  const rx = 3.3 * k, ry = 4.7 * k;
  const mouthY = Y(-10.4), mx = X(0);
  const eyeOpts = { rx, ry, top: '#241a38', bottom: '#7a55c2' };

  const open = (x) => F.eye(ctx, x, eyeY, eyeOpts);
  const lid = (x, side, innerDrop, outerDrop) => {
    // paint a skin-coloured lid over the top of the eye; side = -1 (viewer left) / +1
    const inner = x - side * rx * 1.5, outer = x + side * rx * 1.5;
    ctx.save();
    ctx.fillStyle = P.skin;
    ctx.beginPath();
    ctx.moveTo(inner, eyeY - ry * (1 - innerDrop));
    ctx.lineTo(outer, eyeY - ry * (1 - outerDrop));
    ctx.lineTo(outer, eyeY - ry * 1.6);
    ctx.lineTo(inner, eyeY - ry * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    F.stroke(ctx, [[inner, eyeY - ry * (1 - innerDrop)], [outer, eyeY - ry * (1 - outerDrop)]], { lw: 0.9 * k, color: '#2B2540' });
  };
  const happyEye = (x) => F.closedEye(ctx, x, eyeY + 0.6 * k, { w: 3.3 * k, up: true, lw: 1.05 * k });
  const shutEye = (x) => F.closedEye(ctx, x, eyeY + 0.4 * k, { w: 3.3 * k, up: false, lw: 1.0 * k });

  const blinkable = ['neutral', 'surprised', 'angry', 'sad', 'wink'].includes(expr);
  if (blink && blinkable) {
    shutEye(eyeL);
    if (expr === 'wink') happyEye(eyeR);
    else shutEye(eyeR);
    drawMouth();
    return;
  }

  switch (expr) {
    case 'happy':
      happyEye(eyeL); happyEye(eyeR);
      break;
    case 'surprised':
      F.eye(ctx, eyeL, eyeY, { ...eyeOpts, rx: rx * 1.08, ry: ry * 1.1 });
      F.eye(ctx, eyeR, eyeY, { ...eyeOpts, rx: rx * 1.08, ry: ry * 1.1 });
      break;
    case 'angry':
      open(eyeL); open(eyeR);
      lid(eyeL, -1, 0.55, 0.05); lid(eyeR, 1, 0.55, 0.05);
      break;
    case 'wink':
      open(eyeL); happyEye(eyeR);
      break;
    case 'laugh':
      happyEye(eyeL); happyEye(eyeR);
      break;
    case 'sad':
      open(eyeL); open(eyeR);
      lid(eyeL, -1, 0.05, 0.5); lid(eyeR, 1, 0.05, 0.5);
      // tear
      F.ellipse(ctx, X(-10.8), Y(-8.6), 0.8 * k, 1.2 * k, 'rgba(150,210,255,0.95)');
      break;
    case 'sleepy':
      shutEye(eyeL); shutEye(eyeR);
      break;
    default:
      open(eyeL); open(eyeR);
  }
  drawMouth();

  function drawMouth() {
    switch (expr) {
      case 'happy':
        F.openMouth(ctx, mx, mouthY - 0.6 * k, 3.6 * k, 2.4 * k, { tongue: true });
        break;
      case 'laugh':
        F.openMouth(ctx, mx, mouthY - 1.0 * k, 5.0 * k, 3.6 * k, { tongue: true });
        break;
      case 'surprised':
        F.ellipse(ctx, mx, mouthY + 0.2 * k, 1.1 * k, 1.4 * k, '#7a2843');
        break;
      case 'angry':
        F.stroke(ctx, [[mx - 1.6 * k, mouthY + 0.5 * k], [mx, mouthY - 0.2 * k], [mx + 1.6 * k, mouthY + 0.5 * k]], { color: '#7a3046', lw: 0.6 * k });
        break;
      case 'sad':
        F.smile(ctx, mx, mouthY + 0.8 * k, 2.6 * k, { depth: -0.35, lw: 0.6 * k });
        break;
      case 'sleepy':
        F.ellipse(ctx, mx, mouthY + 0.2 * k, 0.7 * k, 0.8 * k, '#8a3a52');
        break;
      case 'wink':
        F.openMouth(ctx, mx, mouthY - 0.3 * k, 2.8 * k, 1.8 * k, { tongue: true });
        break;
      default:
        F.smile(ctx, mx, mouthY - 0.2 * k, 2.6 * k, { depth: 0.42, lw: 0.6 * k });
    }
  }
}
