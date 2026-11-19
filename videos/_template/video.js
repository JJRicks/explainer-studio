// Starter video. Copy with:  ./studio new <name>   then edit narration.json and this file.
//
// A video module exports one function. It builds everything once — 3D objects, labels, the text
// column — and returns { camera }, a function giving the camera pose for the current time.
// Nothing here runs "per frame" by hand: each object takes functions of time and re-reads them.
import { steps, between, after, pulses, world, K, ring, show, defineMacros } from '../../core/engine.js';
import { C, CSS, sunset, axes, region, graphSurface, rect, fence, curve, point, label, tag, fx } from '../../core/kit/index.js';
import { panel, chapters } from '../../core/panel.js';

const f = (x, y) => 4 - 0.25 * (x - 2.5) ** 2 - 0.25 * (y - 2.5) ** 2;
const Y0 = 1.5; // where scene 2 slices the surface
defineMacros({ '\\F': '4-\\tfrac14(\\X-2.5)^2-\\tfrac14(\\Y-2.5)^2' });

// Camera poses: [azimuth°, polar°, radius, target x, y, z, screen x, y]. Polar 0 looks straight
// down (a 2D picture). The 3D graphic lives in the left ~1150 px; the text column is on the right.
const V = {
  flat: [-90, 0, 16.12, 2.5, 2.55, 0, 590, 592],
  wide: [-56, 60, 21, 2.5, 2.5, 1.4, 600, 620],
  slice: [-76, 68, 19, 2.5, 2.2, 1.6, 600, 620],
};

export default function build() {
  // ---- when things happen: every time is a time expression tied to the narration
  const camera = steps(V.flat, [['1a@surface', 2.6, V.wide], ['2a', 2.2, V.slice]]);
  const surfaceIn = after('1a@surface', 1.0);
  const sliceOn = between('2a@slice', 's2$-0.6');
  const sliceUp = after('2a@slice', 1.2);

  // ---- 3D world
  world.zs = () => 1; // multiply all heights by this; lower it when values dwarf the x/y extent
  axes({ z: [0, 4.8], ticks: { z: [1, 2, 3, 4] }, zOpacity: surfaceIn });
  region([[0, 0], [5, 0], [5, 5], [0, 5]], { fill: 0.22, draw: after('1a@square', 1.2), width: () => 4 + 4 * pulses(['1b@input'], 1.2)() });
  graphSurface({ f, domain: rect(0, 5, 0, 5), color: sunset(0.5, 4), iso: { u: 10, v: 10 }, edge: 0.7, opacity: () => surfaceIn() * (1 - 0.6 * sliceOn()) });
  const wall = fence({ path: s => [5 * s, Y0], top: (x, y) => f(x, y), n: 48, color: C.v, grow: sliceUp, opacity: () => 0.35 * sliceOn(), outline: sliceOn });
  curve({ r: x => [x, Y0, f(x, Y0)], range: [0, 5], color: C.v, draw: sliceUp, opacity: sliceOn });
  point({ at: [3.5, Y0, f(3.5, Y0)], color: C.z, opacity: after('2a@slope') });
  label(tag(`slope ${K('f_x = ' + fx(f, 3.5, Y0).toFixed(2))}`, CSS.z), { at: () => wall.at(0.7, 1), dx: 90, dy: -34, opacity: between('2a@slope', 's2$-0.6') });

  // ---- text column
  chapters([['s1', '1', 'A surface over a square'], ['s2', '2', 'One slice']]);
  {
    const S = panel('s1');
    S.label('The function', { at: '1a+0.2' });
    const eq = S.math(String.raw`\Z \;=\; \htmlClass{rhs}{\F}`, { at: '1a@z', size: 36 });
    ring(eq, '.rhs', between('1a@four', '1a@over'));
    S.text(`Every point ${K('(\\X,\\Y)')} of the square is an <b>input</b>.`, { at: '1b@input', gap: 44 });
    S.text(`The surface gives it a <b>height</b> ${K('\\Z')}.`, { at: '1b@height', gap: 10 });
  }
  {
    const S = panel('s2');
    S.text(`Hold ${K('\\Y = 1.5')} fixed.`, { at: '2a@fixed' });
    const d = S.math(String.raw`\htmlClass{lhs}{\dfrac{\partial f}{\partial \X}}\htmlClass{rhs}{\;=\;-\tfrac12(\X-2.5)}`, { at: '2a@slope', size: 44, gap: 30 });
    show(d, [['.lhs', '2a@partial'], ['.rhs', '2a@partial+1.2']]);
  }
  return { camera };
}
