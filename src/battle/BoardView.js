import * as THREE from 'three';

/**
 * Renders the battle grid on top of whatever map is loaded, using the map's
 * board anchor ({ center, tile, cols, rows }). Maps never draw tiles themselves.
 */
export class BoardView {
  constructor(anchor) {
    this.cols = anchor.cols ?? 8;
    this.rows = anchor.rows ?? 4;
    this.tile = anchor.tile ?? 1.05;
    this.center = anchor.center.clone();
    this.group = new THREE.Group();
    this.group.name = 'board';
    this.tiles = [];
    const shape = roundedRect(this.tile * 0.92, this.tile * 0.92, this.tile * 0.16);
    const geo = new THREE.ShapeGeometry(shape, 6);
    geo.rotateX(-Math.PI / 2);
    for (let c = 0; c < this.cols; c++) {
      for (let r = 0; r < this.rows; r++) {
        const player = c < this.cols / 2;
        const mat = new THREE.MeshBasicMaterial({ color: player ? '#7fb2ff' : '#ff8fa8', transparent: true, opacity: 0.16, depthWrite: false });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(this.tileCenter(c, r)).add(new THREE.Vector3(0, 0.012, 0));
        m.userData = { c, r, player, base: 0.16 };
        m.renderOrder = 1;
        this.group.add(m);
        this.tiles.push(m);
      }
    }
    // centre line
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, this.rows * this.tile),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false })
    );
    line.rotation.x = -Math.PI / 2;
    line.position.copy(this.center).add(new THREE.Vector3(0, 0.013, 0));
    this.group.add(line);
  }

  tileCenter(c, r) {
    return new THREE.Vector3(
      this.center.x + (c - (this.cols - 1) / 2) * this.tile,
      this.center.y,
      this.center.z + (r - (this.rows - 1) / 2) * this.tile
    );
  }

  /** Highlight mode: 'deploy' brightens the player half, 'battle' fades the grid down. */
  setMode(mode) {
    for (const t of this.tiles) {
      const op = mode === 'deploy' ? (t.userData.player ? 0.32 : 0.14) : 0.07;
      t.userData.base = op;
      t.material.opacity = op;
    }
  }

  hover(tile) {
    for (const t of this.tiles) t.material.opacity = t === tile && t.userData.player ? 0.65 : t.userData.base;
  }

  pick(raycaster) {
    const hit = raycaster.intersectObjects(this.tiles, false)[0];
    return hit ? hit.object : null;
  }

  dispose() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.group.removeFromParent();
  }
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
