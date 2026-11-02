/**
 * Pure grid logic (no rendering). Columns run left->right (player side first),
 * rows run back->front (row 0 is farthest from the camera).
 */
export class Board {
  constructor({ cols = 8, rows = 4 } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.cells = new Map();
  }

  key(c, r) {
    return c + ',' + r;
  }

  inBounds(c, r) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  isPlayerSide(c) {
    return c < this.cols / 2;
  }

  at(c, r) {
    return this.cells.get(this.key(c, r)) || null;
  }

  place(unit, c, r) {
    if (unit.c !== undefined && this.at(unit.c, unit.r) === unit) this.cells.delete(this.key(unit.c, unit.r));
    unit.c = c;
    unit.r = r;
    this.cells.set(this.key(c, r), unit);
  }

  remove(unit) {
    if (this.at(unit.c, unit.r) === unit) this.cells.delete(this.key(unit.c, unit.r));
  }

  clear() {
    this.cells.clear();
  }

  static dist(a, b) {
    return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
  }

  /**
   * Shortest walk (8-way, through free tiles, at most maxSteps) that ends as
   * close to `target` as possible, stopping once within `range`.
   */
  path(unit, target, maxSteps, range) {
    if (Board.dist(unit, target) <= range) return [];
    const start = { c: unit.c, r: unit.r };
    const prev = new Map([[this.key(start.c, start.r), null]]);
    let frontier = [start];
    let best = { tile: start, d: Board.dist(start, target), steps: 0 };
    for (let step = 1; step <= maxSteps && frontier.length; step++) {
      const next = [];
      for (const t of frontier) {
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (!dc && !dr) continue;
            const n = { c: t.c + dc, r: t.r + dr };
            const k = this.key(n.c, n.r);
            if (!this.inBounds(n.c, n.r) || prev.has(k) || this.at(n.c, n.r)) continue;
            prev.set(k, t);
            next.push(n);
            const d = Board.dist(n, target);
            const straight = Math.abs(n.r - target.r);
            if (d < best.d || (d === best.d && straight < Math.abs(best.tile.r - target.r))) best = { tile: n, d, steps: step };
          }
        }
      }
      if (best.d <= range) break;
      frontier = next;
    }
    const out = [];
    let cur = best.tile;
    while (cur && !(cur.c === start.c && cur.r === start.r)) {
      out.unshift(cur);
      cur = prev.get(this.key(cur.c, cur.r));
    }
    return out;
  }
}
