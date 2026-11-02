import { D2R, smoothstep } from '../../core/math.js';

/**
 * Clip format (authoring-friendly, degrees + model units):
 * {
 *   duration: 1.0, loop: true|false,
 *   clamp: true            // hold last frame (Die)
 *   next: 'idle'           // clip to return to after a one-shot (default 'idle')
 *   rot: { boneName: [[t, x, y, z], ...] },   // degrees, offsets from rest
 *   pos: { boneName: [[t, x, y, z], ...] },   // model units, offsets from rest
 *   events: [{ t: 0.45, name: 'release' }, { t: 0.1, face: 'angry', hold: 0.8 }]
 * }
 */
function compileTrack(keys, scale) {
  const times = keys.map((k) => k[0]);
  const vals = keys.map((k) => [k[1] * scale, k[2] * scale, k[3] * scale]);
  return { times, vals };
}

export function compileClip(name, def) {
  const tracks = [];
  for (const [bone, keys] of Object.entries(def.rot || {})) tracks.push({ bone, kind: 'rot', ...compileTrack(keys, D2R) });
  for (const [bone, keys] of Object.entries(def.pos || {})) tracks.push({ bone, kind: 'pos', ...compileTrack(keys, 1) });
  return {
    name,
    duration: def.duration,
    loop: !!def.loop,
    clamp: !!def.clamp,
    next: def.next === undefined ? 'idle' : def.next,
    events: (def.events || []).slice().sort((a, b) => a.t - b.t),
    tracks,
  };
}

// Cubic Hermite with finite-difference tangents: smooth through every key.
function sampleTrack(tr, t, out) {
  const { times, vals } = tr;
  const n = times.length;
  if (n === 1 || t <= times[0]) return copy3(vals[0], out);
  if (t >= times[n - 1]) return copy3(vals[n - 1], out);
  let i = 0;
  while (i < n - 2 && t > times[i + 1]) i++;
  const t0 = times[i], t1 = times[i + 1];
  const h = t1 - t0 || 1e-6;
  const s = (t - t0) / h;
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let c = 0; c < 3; c++) {
    const p0 = vals[i][c], p1 = vals[i + 1][c];
    const m0 = i > 0 ? ((p1 - vals[i - 1][c]) / (t1 - times[i - 1])) * h : 0;
    const m1 = i + 2 < n ? ((vals[i + 2][c] - p0) / (times[i + 2] - t0)) * h : 0;
    out[c] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
  }
  return out;
}
function wrapAngle(a) {
  const TAU = Math.PI * 2;
  a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a;
}
function copy3(v, out) {
  out[0] = v[0]; out[1] = v[1]; out[2] = v[2];
  return out;
}

export class Animator {
  constructor(rig, clipDefs) {
    this.rig = rig;
    this.clips = {};
    for (const [name, def] of Object.entries(clipDefs)) this.clips[name] = compileClip(name, def);
    this.cur = null;
    this.prev = null;
    this.fadeT = 0;
    this.fadeDur = 0;
    this.onAnyEvent = null;
    this._pose = {};
    for (const name of Object.keys(rig.bones)) this._pose[name] = { r: [0, 0, 0], p: [0, 0, 0] };
    this._tmp = [0, 0, 0];
  }

  has(name) {
    return !!this.clips[name];
  }

  get current() {
    return this.cur?.clip.name;
  }

  play(name, { fade = 0.15, speed = 1, onEvent = null, onEnd = null } = {}) {
    const clip = this.clips[name];
    if (!clip) {
      console.warn('[Animator] missing clip', name);
      onEnd?.();
      return;
    }
    this.prev = this.cur;
    this.cur = { clip, t: 0, speed, onEvent, onEnd, fired: 0, cycle: 0, done: false };
    this.fadeT = 0;
    this.fadeDur = this.prev ? fade : 0;
  }

  _clipTime(st) {
    const c = st.clip;
    if (c.loop) return st.t % c.duration;
    return Math.min(st.t, c.duration);
  }

  update(dt) {
    const c = this.cur;
    if (!c) return;
    c.t += dt * c.speed;

    // Events (one-shots fire once; loops re-arm every cycle).
    const ct = this._clipTime(c);
    const evs = c.clip.events;
    if (c.clip.loop) {
      const cycle = Math.floor(c.t / c.clip.duration);
      if (cycle !== c.cycle) {
        c.cycle = cycle;
        c.fired = 0;
      }
    }
    while (c.fired < evs.length && ct >= evs[c.fired].t) {
      const ev = evs[c.fired++];
      this.onAnyEvent?.(ev);
      c.onEvent?.(ev);
    }

    if (!c.clip.loop && !c.done && c.t >= c.clip.duration) {
      c.done = true;
      const cb = c.onEnd;
      c.onEnd = null;
      if (!c.clip.clamp && c.clip.next) this.play(c.clip.next, { fade: 0.22 });
      cb?.();
    }

    if (this.prev) {
      this.prev.t += dt * this.prev.speed;
      this.fadeT += dt;
      if (this.fadeT >= this.fadeDur) this.prev = null;
    }
    this._apply();
  }

  _apply() {
    const pose = this._pose;
    for (const k in pose) {
      const p = pose[k];
      p.r[0] = p.r[1] = p.r[2] = 0;
      p.p[0] = p.p[1] = p.p[2] = 0;
    }
    const w = this.prev ? smoothstep(Math.min(1, this.fadeT / Math.max(1e-4, this.fadeDur))) : 1;
    this._accumulate(this.cur, w);
    if (this.prev && w < 1) this._accumulate(this.prev, 1 - w);

    const { bones, rest } = this.rig;
    for (const name in pose) {
      const b = bones[name];
      const r = rest[name];
      if (!b || !r) continue;
      const p = pose[name];
      b.rotation.set(r.rot.x + p.r[0], r.rot.y + p.r[1], r.rot.z + p.r[2]);
      b.position.set(r.pos.x + p.p[0], r.pos.y + p.p[1], r.pos.z + p.p[2]);
    }
  }

  _accumulate(st, w) {
    if (!st) return;
    const t = this._clipTime(st);
    const tmp = this._tmp;
    for (const tr of st.clip.tracks) {
      const p = this._pose[tr.bone];
      if (!p) continue;
      sampleTrack(tr, t, tmp);
      if (tr.kind === 'rot') {
        // wrap so a full 360° spin blends back to rest without unwinding
        tmp[0] = wrapAngle(tmp[0]); tmp[1] = wrapAngle(tmp[1]); tmp[2] = wrapAngle(tmp[2]);
      }
      const dst = tr.kind === 'rot' ? p.r : p.p;
      dst[0] += tmp[0] * w;
      dst[1] += tmp[1] * w;
      dst[2] += tmp[2] * w;
    }
  }
}
