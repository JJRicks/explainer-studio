// Small marks: points, straight segments, 3D-anchored labels, and the "drop a point to its height" figure.
import { Segs, dot, mk, val, Z, lerp3, onFrame } from '../engine.js';
import { C } from './colors.js';

/** A pill-backed label body, legible on top of graphics: tag('height', CSS.z). */
export const tag = (html, color = 'var(--ink)') => `<span class="tag" style="color:${color}">${html}</span>`;

/**
 * Text that follows a 3D point. `at` is [x, y, z] in WORLD units (heights already scaled:
 * use Z(v) or a kit handle's .at()). dx, dy are pixel offsets on screen.
 */
export function label(html, { at, dx = 0, dy = 0, opacity = 1, scale, size, cls, f } = {}) {
  return mk(html, { pos: () => val(at), dx, dy, a: () => val(opacity), s: scale ? () => val(scale) : undefined, size, cls, f });
}

/** A round marker of constant screen size. `at` is [x, y, height] with height in function units. */
export function point({ at, color = C.ink, px = 9, opacity = 1, scale = 1, order } = {}) {
  const set = dot(color, px, order);
  const world = () => { const p = val(at); return [p[0], p[1], Z(p[2] || 0)]; };
  onFrame(() => set(world(), val(opacity), val(scale)));
  return { at: world };
}

/**
 * A straight segment between two points given as [x, y, height]. `grow` draws it from 0 to 1;
 * `dashed` is true or [dash, gap] in world units.
 */
export function segment({ from, to, color = C.ink, width = 3, opacity = 1, grow = 1, dashed = false, order = 7 } = {}) {
  const segs = new Segs(dashed ? 200 : 1, { color, width, order });
  const w = p => [p[0], p[1], Z(p[2] || 0)];
  onFrame(() => {
    const a = val(opacity), g = val(grow);
    segs.begin();
    if (a > 0.004 && g > 0.002) {
      const p = w(val(from)), q = lerp3(p, w(val(to)), g);
      if (dashed) segs.dashed(p, q, ...(Array.isArray(dashed) ? dashed : [0.14, 0.1])); else segs.seg(p, q);
    }
    segs.end(a);
  });
  return { at: u => lerp3(w(val(from)), w(val(to)), u) };
}

/**
 * The standard "input on the floor, output at its height" figure: a floor dot at (x, y), optional
 * dashed guides to the axes, a dashed vertical to height z, and a dot there.
 */
export function dropLine({ at, z, color = C.z, opacity = 1, grow = 1, guides = true } = {}) {
  const xy = () => val(at), h = () => val(z) * val(grow);
  point({ at: () => [...xy(), 0], color: C.ink, opacity });
  if (guides) {
    segment({ from: () => [xy()[0], 0, 0], to: () => [...xy(), 0], color: C.dim, width: 2, dashed: true, opacity: () => val(opacity) * 0.8, order: 6 });
    segment({ from: () => [0, xy()[1], 0], to: () => [...xy(), 0], color: C.dim, width: 2, dashed: true, opacity: () => val(opacity) * 0.8, order: 6 });
  }
  segment({ from: () => [...xy(), 0], to: () => [...xy(), h()], color, dashed: [0.22, 0.14], opacity: () => (Math.abs(val(grow)) > 0.01 ? val(opacity) : 0) });
  point({ at: () => [...xy(), h()], color, px: 10, opacity: () => (Math.abs(val(grow)) > 0.01 ? val(opacity) : 0) });
  return { floor: () => [...xy(), 0], top: () => [...xy(), Z(h())] };
}
