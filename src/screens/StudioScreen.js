import * as THREE from 'three';
import { Character } from '../characters/Character.js';
import { getUnit } from '../characters/registry.js';
import { skillsFor } from '../skills/registry.js';
import { gradientTexture } from '../core/textures.js';
import { h, icon } from '../ui/dom.js';
import { ICONS } from '../ui/icons.js';
import { ease } from '../core/math.js';
import { bodyChoice, BODY_LABELS } from '../characters/bodyChoice.js';

const CLIP_LABELS = [
  ['idle', 'Idle'],
  ['walk', 'Walk'],
  ['attack', 'Attack'],
  ['skill', 'Skill'],
  ['hit', 'Hit'],
  ['die', 'Die'],
  ['victory', 'Victory'],
];
const VIEWS = [
  ['Front', 0],
  ['3/4', -0.75],
  ['Side', -Math.PI / 2],
  ['Back', Math.PI],
];

/** Hero studio: turntable, animation + expression preview, skills and model specs. */
export class StudioScreen {
  constructor(game) {
    this.game = game;
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
  }

  async enter({ heroId = 'lyra' } = {}) {
    const g = this.game;
    this.def = getUnit(heroId);
    this.scene = g.newScene();
    this.scene.environmentIntensity = 0.55;
    this.scene.background = gradientTexture('studio', [[0, '#3a2a6e'], [0.6, '#5b3f9e'], [1, '#2b2540']]);
    this.scene.add(new THREE.HemisphereLight('#fff4ff', '#4b3a8a', 1.25));
    const key = new THREE.DirectionalLight('#fff3ea', 2.3);
    key.position.set(2, 4, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = key.shadow.camera.bottom = -2;
    key.shadow.camera.right = key.shadow.camera.top = 2;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#e0b8ff', 1.6);
    rim.position.set(-3, 3, -4);
    this.scene.add(rim);

    // pedestal
    const ped = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.92, 0.16, 64), new THREE.MeshStandardMaterial({ color: '#4a3a8c', roughness: 0.5 }));
    top.position.y = -0.08;
    top.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.035, 8, 80), new THREE.MeshStandardMaterial({ color: '#ffd45c', metalness: 0.6, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2;
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.78, 64), new THREE.MeshBasicMaterial({ color: '#c57cff', transparent: true, opacity: 0.35, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.005;
    ped.add(top, ring, glow);
    this.scene.add(ped);
    this.pedestal = ped;

    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);
    this.hero = new Character(this.def);
    this.turntable.add(this.hero.root);
    this.yaw = -0.45;
    this.targetYaw = this.yaw;
    this.zoom = 0;
    this.targetZoom = 0;
    this.autoSpin = false;
    this.loopClip = 'idle';
    this.t = 0;
    this.buildUI();
    this.updateCamera(1);
  }

  updateCamera(k) {
    // full body <-> face close-up; subject sits left of centre (panel on the right)
    const z = ease.inOut(this.zoom);
    const pos = new THREE.Vector3().lerpVectors(new THREE.Vector3(0.62, 0.95, 3.6), new THREE.Vector3(0.24, 0.92, 1.45), z);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0.62, 0.62, 0), new THREE.Vector3(0.24, 0.84, 0), z);
    this.camera.position.lerp(pos, k);
    this._look = (this._look || look.clone()).lerp(look, k);
    this.camera.lookAt(this._look);
  }

  buildUI() {
    const g = this.game, def = this.def;
    const kit = skillsFor(def);
    const stats = this.hero.built.stats;
    const tabs = {};
    const tabBtns = {};
    const show = (name) => {
      for (const [k, el] of Object.entries(tabs)) el.hidden = k !== name;
      for (const [k, b] of Object.entries(tabBtns)) b.classList.toggle('active', k === name);
    };

    // Animations
    this.clipBtns = {};
    tabs.anim = h(
      'div',
      { class: 'tab-body' },
      h('p', { class: 'hint' }, 'Tap a move to preview it. Loops keep playing; one-shots return to Idle.'),
      h(
        'div',
        { class: 'grid-btns' },
        CLIP_LABELS.map(([id, label]) => (this.clipBtns[id] = h('button', { class: 'btn btn-purple small', onclick: () => this.playClip(id) }, label)))
      )
    );

    // Expressions (rendered portraits of each face)
    tabs.face = h(
      'div',
      { class: 'tab-body', hidden: true },
      h('p', { class: 'hint' }, 'Face variants from the model sheet. Tap one to try it on.'),
      h(
        'div',
        { class: 'faces' },
        (def.expressions || []).map((ex) =>
          h('button', { class: 'face-chip', onclick: () => this.tryFace(ex) }, h('img', { src: g.portraits.get(def.id, { expression: ex, yaw: 0, t: 0.01 }), alt: '' }), h('span', {}, cap(ex)))
        )
      )
    );

    // Skills
    const skillCard = (s, tag) =>
      h(
        'div',
        { class: 'skill-card' },
        h('div', { class: 'skill-ico', style: { '--c': s.color } }, icon(ICONS[s.icon] || ICONS.orb)),
        h('div', { class: 'skill-txt' }, h('div', { class: 'skill-head' }, h('b', {}, s.name), h('span', { class: `tag ${tag}` }, s.cost ? `${tag} · ${s.cost} energy` : tag)), h('p', {}, s.description))
      );
    tabs.skills = h('div', { class: 'tab-body', hidden: true }, [kit.basic && skillCard(kit.basic, 'Basic'), ...kit.active.map((s) => skillCard(s, 'Active')), kit.passive && skillCard(kit.passive, 'Passive')]);

    // Model specs (+ body switch when a hero has Blender variants)
    const pal = Object.entries(def.palette || {});
    this.bodyBtns = {};
    tabs.model = h(
      'div',
      { class: 'tab-body', hidden: true },
      h(
        'table',
        { class: 'specs' },
        h(
          'tbody',
          {},
          specRow('Height', `${def.sheet?.heightHeads ?? '?'} heads (head ${def.sheet?.head}, body ${def.sheet?.body})`),
          (def.bodies?.length > 1 || null) &&
            h(
              'tr',
              {},
              h('th', {}, 'Body'),
              h(
                'td',
                { class: 'body-pick' },
                def.bodies.map((k) => (this.bodyBtns[k] = h('button', { class: 'pill small', onclick: () => this.setBody(k) }, BODY_LABELS[k] || k)))
              )
            ),
          h('tr', {}, h('th', {}, 'Triangles'), (this.trisCell = h('td', {}, stats.tris.toLocaleString('en-US')))),
          specRow('Bones', String(stats.bones)),
          specRow('Clips', Object.keys(def.clips).map(cap).join(', ')),
          specRow('Style', def.sheet?.style || '')
        )
      ),
      h('div', { class: 'swatches' }, pal.map(([name, hex]) => h('div', { class: 'swatch', title: `${name} ${hex}` }, h('i', { style: { background: hex } }), h('small', {}, hex))))
    );

    const s = def.stats;
    this.ui = h(
      'div',
      { class: 'screen studio' },
      h('button', { class: 'btn-round back', onclick: () => g.go('home'), 'aria-label': 'Back' }, icon(ICONS.back)),
      h(
        'div',
        { class: 'view-bar panel' },
        VIEWS.map(([label, yaw]) => h('button', { class: 'pill', onclick: () => this.setView(yaw) }, label)),
        (this.zoomBtn = h('button', { class: 'pill', onclick: () => this.toggleZoom() }, 'Face')),
        (this.spinBtn = h('button', { class: 'pill', onclick: () => this.toggleSpin() }, icon(ICONS.rotate), 'Spin'))
      ),
      h('div', { class: 'drag-hint' }, 'Drag to rotate'),
      h(
        'aside',
        { class: 'hero-panel panel' },
        h(
          'header',
          {},
          h('div', { class: 'stars' }, [1, 2, 3, 4].map(() => icon(ICONS.star, 'ico star'))),
          h('h1', {}, def.name),
          h('div', { class: 'hero-title' }, def.title),
          h('div', { class: 'chips' }, h('span', { class: 'chip' }, icon(ICONS.mage), def.role), h('span', { class: 'chip' }, icon(ICONS.arcane), def.element), h('span', { class: 'chip rarity' }, def.rarity))
        ),
        h('div', { class: 'stat-row' }, stat('HP', s.hp), stat('ATK', s.atk), stat('DEF', s.def), stat('SPD', s.spd), stat('Range', s.range)),
        h(
          'div',
          { class: 'tabs' },
          [
            ['anim', 'Moves'],
            ['face', 'Faces'],
            ['skills', 'Skills'],
            ['model', 'Model'],
          ].map(([k, label]) => (tabBtns[k] = h('button', { class: 'tab', onclick: () => show(k) }, label)))
        ),
        Object.values(tabs)
      )
    );
    show('anim');
    this.markClip('idle');
    this.markBody();
    g.ui.append(this.ui);
  }

  playClip(id) {
    const clip = this.hero.animator.clips[id];
    if (!clip) return;
    this.markClip(id);
    if (clip.loop) {
      this.loopClip = id;
      this.hero.play(id);
      if (id === 'idle') this.hero.setExpression('neutral', 0);
    } else {
      this.hero.alive = true;
      this.hero.play(id).then(() => {
        if (id === 'die') {
          setTimeout(() => {
            if (!this.hero) return;
            this.hero.alive = true;
            this.hero.play('idle', { fade: 0.4 });
            this.hero.setExpression('happy', 1);
            this.markClip('idle');
          }, 900);
        } else this.markClip(this.loopClip === id ? id : 'idle');
      });
      if (id === 'die') this.hero.alive = false;
    }
  }

  markClip(id) {
    for (const [k, b] of Object.entries(this.clipBtns || {})) b.classList.toggle('active', k === id);
  }

  tryFace(ex) {
    this.hero.setExpression(ex, 2.5);
    if (this.zoom < 0.5) this.toggleZoom();
  }

  setView(yaw) {
    this.autoSpin = false;
    this.spinBtn.classList.remove('active');
    // pick the shortest way round
    const d = Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
    this.targetYaw = this.yaw + d;
  }

  toggleZoom() {
    this.targetZoom = this.targetZoom > 0.5 ? 0 : 1;
    this.zoomBtn.classList.toggle('active', this.targetZoom > 0.5);
  }

  toggleSpin() {
    this.autoSpin = !this.autoSpin;
    this.spinBtn.classList.toggle('active', this.autoSpin);
  }

  onPointerDown(ndc, e) {
    this.drag = { x: e.clientX, yaw: this.targetYaw };
    this.autoSpin = false;
    this.spinBtn.classList.remove('active');
  }

  onPointerMove(ndc, e) {
    if (!this.drag || !(e.buttons & 1)) return;
    this.targetYaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.012;
  }

  onPointerUp() {
    this.drag = null;
  }

  update(dt) {
    this.t += dt;
    if (this.autoSpin) this.targetYaw += dt * 0.7;
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    this.turntable.rotation.y = this.yaw;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 5);
    this.updateCamera(Math.min(1, dt * 6));
    this.hero.update(dt);
  }

  /** Swap the hero's body (code / Blender variants); the choice applies everywhere. */
  setBody(key) {
    bodyChoice.set(this.def.id, key);
    const old = this.hero;
    this.hero = new Character(this.def);
    this.turntable.add(this.hero.root);
    old.dispose();
    this.trisCell.textContent = this.hero.built.stats.tris.toLocaleString('en-US');
    this.markBody();
    this.markClip('idle');
    this.hero.setExpression('happy', 1.2);
  }

  markBody() {
    const cur = bodyChoice.get(this.def.id, this.def.defaultBody || 'code');
    const pick = this.hero.built.stats.source === 'code' ? 'code' : cur;
    for (const [k, b] of Object.entries(this.bodyBtns || {})) b.classList.toggle('active', k === pick);
  }

  async exit() {
    this.ui.remove();
    this.hero.dispose();
    this.hero = null;
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const stat = (label, v) => h('div', { class: 'stat' }, h('small', {}, label), h('b', {}, String(v)));
const specRow = (k, v) => h('tr', {}, h('th', {}, k), h('td', {}, v));
