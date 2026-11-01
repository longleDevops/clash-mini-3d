/** Free GPU memory for everything under an Object3D (geometries, materials, textures). */
export function disposeObject(root) {
  if (!root) return;
  const mats = new Set();
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => mats.add(x));
    else if (m) mats.add(m);
  });
  for (const m of mats) {
    for (const k of ['map', 'emissiveMap', 'alphaMap']) {
      if (m[k] && m[k].userData?.owned) m[k].dispose();
    }
    m.dispose();
  }
  root.removeFromParent();
}
