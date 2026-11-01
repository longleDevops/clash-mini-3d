import * as THREE from 'three';

/**
 * A lightweight rigid-part skeleton: every bone is a THREE.Group, meshes are
 * parented to bones. Chibi models are built from rounded parts, so rigid
 * skinning keeps them crisp and cheap while still giving a real bone
 * hierarchy that the Animator can drive (and that a future glTF rig can map to).
 *
 * Shared bone names (any humanoid hero should use these so clips can be reused):
 *   base, hips, spine, chest, neck, head,
 *   armL, foreArmL, handL, armR, foreArmR, handR,
 *   thighL, shinL, footL, thighR, shinR, footR
 * Optional extras: earL, earR, hairBack, skirt, tail0..tailN, prop
 */
export class Rig {
  constructor() {
    this.bones = {};
    this.rest = {};
  }

  bone(name, parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
    const b = new THREE.Group();
    b.name = name;
    b.position.set(pos[0], pos[1], pos[2]);
    b.rotation.set(rot[0], rot[1], rot[2]);
    parent.add(b);
    this.bones[name] = b;
    return b;
  }

  /** Snapshot the current transforms as the rest pose (clips are offsets from it). */
  captureRest() {
    for (const [name, b] of Object.entries(this.bones)) {
      this.rest[name] = { rot: b.rotation.clone(), pos: b.position.clone() };
    }
  }

  get count() {
    return Object.keys(this.bones).length;
  }
}
