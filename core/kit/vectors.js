// Arrows and vector fields.
import { THREE, scene, Segs, val, Z, onFrame, camScale, lerp } from '../engine.js';
import { C, asMap } from './colors.js';

const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const coneGeo = () => new THREE.ConeGeometry(0.085, 0.26, 16);

/**
 * One arrow from `from` to `to`, both [x, y, height]. For gradient vectors, normals, tangents,
 * displacement, velocity. `head` scales the arrowhead.
 */
export function arrow({ from, to, color = C.ink, width = 4, opacity = 1, head = 1, order = 9 } = {}) {
  const shaft = new Segs(1, { color, width, order });
  const tip = new THREE.Mesh(coneGeo(), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
  tip.renderOrder = order; scene.add(tip);
  const w = p => [p[0], p[1], Z(p[2] || 0)];
  onFrame(() => {
    const a = val(opacity), p = w(val(from)), q = w(val(to));
    _d.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    const len = _d.length(), hs = val(head) * camScale(), hl = Math.min(0.26 * hs, len * 0.6);
    if (a < 0.004 || len < 1e-6) { shaft.begin().end(0); tip.visible = false; return; }
    _d.multiplyScalar(1 / len);
    shaft.begin().seg(p, [q[0] - _d.x * hl, q[1] - _d.y * hl, q[2] - _d.z * hl]).end(a);
    tip.visible = true; tip.material.opacity = a;
    tip.quaternion.setFromUnitVectors(UP, _d);
    tip.scale.set(hs, hl / 0.26, hs);
    tip.position.set(q[0] - _d.x * hl / 2, q[1] - _d.y * hl / 2, q[2] - _d.z * hl / 2);
  });
  return { tip: () => w(val(to)) };
}

/** Sample points on a grid: gridPoints({ x: [0, 5, 9], y: [0, 5, 9], z: 0, inside: (x, y) => … }). z may be [lo, hi, n]. */
export function gridPoints({ x, y, z = 0, inside } = {}) {
  const ax = ([a, b, n]) => Array.from({ length: n }, (_, i) => lerp(a, b, n === 1 ? 0.5 : i / (n - 1)));
  const zs = Array.isArray(z) ? ax(z) : [z], out = [];
  for (const px of ax(x)) for (const py of ax(y)) for (const pz of zs) if (!inside || inside(px, py, pz)) out.push([px, py, pz]);
  return out;
}

/**
 * A field of arrows: F(x, y, height, i) -> [u, v, w] drawn at each of `points`.
 *   points      [[x, y, height], ...] or () => that (same length every frame)
 *   scale       arrow length per unit of |F|        maxLength   clamp for long arrows
 *   normalize   draw every arrow at length `scale` (direction field)
 *   color       hex, or a colormap applied to |F|
 * Works for 2D fields on the floor, 3D fields, gradients (F: grad(f)), tangents along a curve,
 * and normals on a surface (points taken from the surface).
 */
export function vectorField({ F, points, scale = 1, maxLength = Infinity, normalize = false, color = C.v, width = 2.5, opacity = 1, head = 0.7, order = 8 } = {}) {
  const cm = asMap(color), count = val(points).length;
  const shafts = new Segs(count, { width, order, colors: true });
  const tips = new THREE.InstancedMesh(coneGeo(), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), count);
  tips.renderOrder = order; tips.frustumCulled = false; scene.add(tips);
  onFrame(() => {
    const a = val(opacity);
    if (a < 0.004) { shafts.begin().end(0); tips.visible = false; return; }
    const pts = val(points), hs = val(head) * camScale(), k = val(scale);
    shafts.begin();
    for (let i = 0; i < count; i++) {
      const p = pts[i], f = F(p[0], p[1], p[2] || 0, i), mag = Math.hypot(f[0], f[1], f[2] || 0);
      let len = normalize ? k : Math.min(mag * k, maxLength);
      if (!(mag > 1e-9) || len < 1e-4) { _m.makeScale(0, 0, 0); tips.setMatrixAt(i, _m); continue; }
      const c = cm(mag), x0 = p[0], y0 = p[1], z0 = Z(p[2] || 0);
      _d.set(f[0], f[1], Z(f[2] || 0)).normalize();
      const hl = Math.min(0.26 * hs, len * 0.5);
      shafts.seg([x0, y0, z0], [x0 + _d.x * (len - hl), y0 + _d.y * (len - hl), z0 + _d.z * (len - hl)], c);
      _q.setFromUnitVectors(UP, _d);
      _p.set(x0 + _d.x * (len - hl / 2), y0 + _d.y * (len - hl / 2), z0 + _d.z * (len - hl / 2));
      tips.setMatrixAt(i, _m.compose(_p, _q, _s.set(hs, hl / 0.26, hs)));
      tips.setColorAt(i, c);
    }
    shafts.end(a);
    tips.visible = true; tips.material.opacity = a;
    tips.instanceMatrix.needsUpdate = true;
    if (tips.instanceColor) tips.instanceColor.needsUpdate = true;
  });
}
