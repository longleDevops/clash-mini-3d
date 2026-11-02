import { ease as easings } from './math.js';

/**
 * Game-time clock. Battle speed (x1/x2) and pause scale this clock, so every
 * wait, tween and animation driven from it speeds up / freezes together.
 */
export class Clock {
  constructor() {
    this.time = 0;
    this.scale = 1;
    this.paused = false;
    this._waits = [];
    this._tweens = [];
  }

  /** Advance by real seconds; returns the scaled delta actually applied. */
  tick(realDt) {
    const dt = this.paused ? 0 : realDt * this.scale;
    this.time += dt;
    for (let i = this._waits.length - 1; i >= 0; i--) {
      const w = this._waits[i];
      if (this.time >= w.at) {
        this._waits.splice(i, 1);
        w.resolve();
      }
    }
    for (let i = this._tweens.length - 1; i >= 0; i--) {
      const tw = this._tweens[i];
      const k = Math.min(1, (this.time - tw.start) / tw.dur);
      tw.fn(tw.ease(k), k);
      if (k >= 1) {
        this._tweens.splice(i, 1);
        tw.resolve();
      }
    }
    return dt;
  }

  wait(sec) {
    return new Promise((resolve) => this._waits.push({ at: this.time + Math.max(0, sec), resolve }));
  }

  /** fn(easedT, rawT) is called every tick until done. */
  tween(dur, fn, ease = easings.inOut) {
    return new Promise((resolve) => {
      fn(0, 0);
      this._tweens.push({ start: this.time, dur: Math.max(1e-4, dur), fn, ease, resolve });
    });
  }

  /** Drop everything pending (used when a screen is torn down). */
  reset() {
    this._waits.length = 0;
    this._tweens.length = 0;
    this.scale = 1;
    this.paused = false;
  }
}
