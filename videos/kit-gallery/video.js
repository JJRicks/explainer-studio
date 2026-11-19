// Kit gallery: every kit object, one short silent scene each. It is the visual test for the kit
// (render it after changing anything in core/) and a cookbook — copy a scene as a starting point.
//
// Each scene function is self-contained: it builds its objects and shows them only during its own
// scene. Silent cues in narration.json give each scene a fixed length, so no TTS is needed.
import { clock, steps, between, T, K, smooth, clamp01, lerp, Z } from '../../core/engine.js';
import * as kit from '../../core/kit/index.js';
import { panel, chapters } from '../../core/panel.js';

const { C, CSS } = kit;
const TAU = 2 * Math.PI;

/** Visible for the length of scene `id`. */
const vis = id => between(id, `${id}$-0.6`);
/** 0 -> 1 between fractions a and b of scene `id`. */
const prog = (id, a = 0, b = 1) => { const t0 = T(id), t1 = T(`${id}$`); return () => smooth(clamp01(((clock.t - t0) / (t1 - t0) - a) / (b - a))); };
const any = (...fs) => () => Math.max(...fs.map(f => f()));
const code = (S, text, opt = {}) => S.text(`<code>${text}</code>`, { size: 22, gap: 10, wrap: true, ...opt });

const hill = (x, y) => 0.4 + 3 * Math.exp(-((x - 2.2) ** 2 + (y - 2.8) ** 2) / 2.6) + 0.12 * x;
const HEAT = kit.sunset(0.3, 3.9);

const V = {
  g1: [-90, 0, 14, 0.5, 2.05, 0, 590, 590],
  g2: [-58, 60, 21, 2.5, 2.5, 1.2, 600, 630],
  g3: [-50, 62, 18.5, 2.6, 2.5, 1.2, 600, 630],
  g4: [-58, 56, 21, 2.5, 2.5, 1.0, 600, 630],
  g5: [-62, 56, 19, 0, 0, 1.2, 600, 610],
  g6: [-58, 62, 19, 0, 0, 0.9, 600, 600],
  g7: [-90, 0, 16.12, 2.5, 2.55, 0, 590, 592],
  g7b: [-74, 50, 18, 2.5, 2.5, 0.2, 600, 600],
  g8: [-56, 62, 17.5, 2.5, 2.5, 1.5, 600, 570],
  g9: [-90, 0, 10.5, 1.55, 1.5, 0, 600, 590],
  g10: [-52, 62, 19, 0, 0, 2.0, 600, 600],
  g11: [-90, 0, 16.5, 0, 0, 0, 600, 590],
};

// ---------------------------------------------------------------- 1 · a region and its bounds
function bounds() {
  const on = vis('g1'), t = prog('g1', 0.3, 0.9);
  const lo = x => x * x, hi = x => x + 2;
  kit.axes({ x: [-2.2, 3.2], y: [-0.7, 4.8], ticks: { x: [-2, -1, 1, 2, 3], y: [1, 2, 3, 4] }, grid: { x: [-2, 3], y: [0, 4], step: 1 }, opacity: on });
  kit.region(kit.typeI(-1, 2, lo, hi), { fill: () => 0.22 * on(), line: on, draw: prog('g1', 0.02, 0.25) });
  kit.curve({ r: x => [x, lo(x), 0], range: [-1.5, 2.15], color: C.z, opacity: on });
  kit.curve({ r: x => [x, hi(x), 0], range: [-1.8, 2.6], color: C.u, opacity: on });
  const s = kit.sweep({ type: 'I', range: [-1, 2], lo, hi, t: () => lerp(-1, 2, t()), lead: on, paint: () => 0.4 * on(), color: C.y });
  kit.label(kit.tag(K('\\Y = \\X^2'), CSS.z), { at: [1.9, 3.61, 0], dx: 74, opacity: on });
  kit.label(kit.tag(K('\\Y = \\X + 2'), CSS.u), { at: [0.1, 2.1, 0], dx: -84, dy: -28, opacity: on });
  kit.label(kit.tag(K('\\X'), CSS.y), { at: () => [s.start()[0], 0, 0], dy: 54, opacity: on });

  const S = panel('g1');
  S.label('Kit calls on screen');
  code(S, 'region(typeI(-1, 2, x =&gt; x*x, x =&gt; x + 2))');
  code(S, 'sweep({ type: "I", range: [-1, 2], lo, hi, t })');
  code(S, 'curve({ r: x =&gt; [x, x*x, 0] })');
  S.text('Each strip is the inner integral; the sweep is the outer one. Type "II" gives horizontal strips.', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`\int_{-1}^{2}\!\int_{\X^2}^{\X+2} f\,d\Y\,d\X`, { size: 44, gap: 36 });
}

// ---------------------------------------------------------------- 2 · a graph and its level curves
function surface() {
  const on = vis('g2'), lift = prog('g2', 0.45, 0.85);
  kit.graphSurface({ f: hill, domain: kit.rect(0, 5, 0, 5), color: HEAT, iso: { u: 10, v: 10 }, edge: 0.7, opacity: () => on() * lerp(1, 0.4, lift()) });
  kit.contours({ f: hill, levels: [1, 1.5, 2, 2.5, 3], color: HEAT, width: 3.5, opacity: on, lift });

  const S = panel('g2');
  S.label('Kit calls on screen');
  code(S, 'graphSurface({ f, domain: rect(0, 5, 0, 5), color: sunset(lo, hi) })');
  code(S, 'contours({ f, levels, lift })');
  S.text('Level curves drawn on the floor, then lifted to their own heights — where they lie on the surface.', { size: 26, wrap: true, gap: 40 });
  S.text('Above opacity 0.6 a surface is solid; below, see-through.', { size: 24, cls: 'dim', wrap: true, gap: 24 });
}

// ---------------------------------------------------------------- 3 · slice, tangent plane, gradient
function tangent() {
  const on = vis('g3'), u = prog('g3', 0.08, 0.95);
  const P = () => { const s = u(); return [1.2 + 2.2 * s, 2.0 + 0.9 * Math.sin(Math.PI * s)]; };
  const at = () => { const [x, y] = P(); return [x, y, hill(x, y)]; };
  kit.graphSurface({ f: hill, domain: kit.rect(0, 5, 0, 5), color: HEAT, iso: { u: 10, v: 10, opacity: 0.25 }, edge: 0.5, opacity: () => 0.42 * on() });
  kit.fence({ path: s => [5 * s, P()[1]], top: (x, y) => hill(x, y), n: 48, color: C.v, opacity: () => 0.3 * on(), outline: on });
  kit.tangentPlane({ f: hill, at: P, size: 1.7, opacity: () => 0.5 * on() });
  kit.dropLine({ at: P, z: () => hill(...P()), opacity: on, guides: false });
  const gradTip = () => { const [x, y] = P(); return [x + 0.8 * kit.fx(hill, x, y), y + 0.8 * kit.fy(hill, x, y), 0]; };
  kit.arrow({ from: () => [...P(), 0], to: gradTip, color: C.u, opacity: on });
  const slopeTip = () => { const [x, y, z] = at(); return [x + 0.9, y, z + 0.9 * kit.fx(hill, x, y)]; };
  kit.arrow({ from: at, to: slopeTip, color: C.v, opacity: on });
  kit.label(kit.tag(K('\\nabla f'), CSS.u), { at: gradTip, dx: 44, dy: 14, opacity: on });
  kit.label(kit.tag(K('f_x'), CSS.v), { at: () => { const p = slopeTip(); return [p[0], p[1], Z(p[2])]; }, dx: 40, dy: -16, opacity: on });

  const S = panel('g3');
  S.label('Kit calls on screen');
  code(S, 'fence({ path: s =&gt; [5*s, y0], top: f })&ensp;<span class="dim">// slice y = y0</span>');
  code(S, 'tangentPlane({ f, at: () =&gt; [x0, y0] })');
  code(S, 'arrow({ from, to })&ensp;<span class="dim">// ∇f on the floor, slope in the slice</span>');
  code(S, 'dropLine({ at, z })');
  S.text('fx and fy from the kit are numeric partial derivatives; grad(f) is a ready-made field.', { size: 26, wrap: true, gap: 40 });
}

// ---------------------------------------------------------------- 4 · Riemann sums
function riemann() {
  const on = vis('g4'), fine = prog('g4', 0.5, 0.58), g = prog('g4', 0.05, 0.3);
  const coarse = kit.rectCells({ x: [0, 5, 5], y: [0, 5, 5], f: hill }), dense = kit.rectCells({ x: [0, 5, 14], y: [0, 5, 14], f: hill });
  kit.columns({ cells: coarse, height: c => c.v * g(), color: HEAT, opacity: () => on() * (1 - fine()) });
  kit.columns({ cells: dense, color: HEAT, shrink: 0.86, opacity: () => on() * fine() });

  const S = panel('g4');
  S.label('Kit calls on screen');
  code(S, 'columns({ cells: rectCells({ x: [0, 5, n], y: [0, 5, n], f }) })');
  S.text(`${K('25')} cells:&ensp;${K(`\\sum f\\,\\Delta A = ${kit.riemannSum(coarse).toFixed(2)}`)}`, { at: 'g4+1.6', gap: 44 });
  S.text(`${K('196')} cells:&ensp;${K(`\\sum f\\,\\Delta A = ${kit.riemannSum(dense).toFixed(2)}`)}`, { at: T('g4') + 0.56 * (T('g4$') - T('g4')), gap: 14 });
  S.text('riemannSum(cells) and cellMean(cells) give the numbers. triangleCells and polarCells make other tilings.', { size: 26, wrap: true, gap: 44 });
}

// ---------------------------------------------------------------- 5 · polar regions and polar cells
function polarScene() {
  const on = vis('g5'), cut = prog('g5', 0.42, 0.5), g = prog('g5', 0.46, 0.72);
  const bowl = (x, y) => 4 - 0.5 * (x * x + y * y), heat = kit.sunset(0.5, 4), t1 = 1.5 * Math.PI;
  kit.region(kit.polarRegion(0, t1, 0.6, 2.5), { fill: () => 0.22 * on(), line: on });
  kit.graphSurface({ f: bowl, domain: kit.overPolar(0.6, 2.5, 0, t1), nu: 16, nv: 56, color: heat, iso: { u: 5, v: 14 }, edge: 0.7, walls: 0.2, opacity: () => on() * (1 - cut()) });
  kit.columns({ cells: kit.polarCells({ r: [0.6, 2.5, 5], th: [0, t1, 14], f: bowl }), height: c => c.v * g(), color: heat, shrink: 0.88, opacity: () => on() * cut() });

  const S = panel('g5');
  S.label('Kit calls on screen');
  code(S, 'region(polarRegion(0, 3π/2, 0.6, 2.5))');
  code(S, 'graphSurface({ f, domain: overPolar(0.6, 2.5, 0, 3π/2) })');
  code(S, 'columns({ cells: polarCells({ r: [0.6, 2.5, 5], th: [0, 3π/2, 14], f }) })');
  S.text('Outer cells are bigger than inner ones. That is the extra factor in', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`dA = r\,dr\,d\theta`, { size: 44, gap: 14 });
}

// ---------------------------------------------------------------- 6 · volume elements
function solids() {
  const on = vis('g6'), g = prog('g6', 0.08, 0.5);
  kit.paramSurface({ r: (u, v) => kit.spherical(2.6, (u * Math.PI) / 2, v * TAU), nu: 12, nv: 48, color: C.D, lit: false, opacity: () => 0.1 * on(), iso: { u: 4, v: 12, opacity: 2.2 } });
  const sph = kit.paramSolid({ r: kit.sphMap({ rho: () => [1.5, lerp(1.6, 2.6, g())], phi: [0.55, 1.05], th: [0.2, 0.85] }), color: C.z, opacity: () => 0.5 * on() });
  const cyl = kit.paramSolid({ r: kit.cylMap({ r: [1.2, 2.2], th: [3.45, 4.25], z: () => [0, lerp(0.1, 1.7, g())] }), color: C.y, opacity: () => 0.5 * on() });
  const box = kit.paramSolid({ r: kit.boxMap({ x: [1.0, 2.2], y: [-2.6, -1.4], z: () => [0, lerp(0.1, 1.2, g())] }), color: C.w, opacity: () => 0.5 * on() });
  kit.label(kit.tag(K('\\rho^2\\sin\\varphi\\,d\\rho\\,d\\varphi\\,d\\theta'), CSS.z), { at: () => sph.at(1, 0, 0.5), dx: 40, dy: -44, opacity: on });
  kit.label(kit.tag(K('r\\,dr\\,d\\theta\\,dz'), CSS.y), { at: () => cyl.at(1, 0.5, 1), dx: -70, dy: -40, opacity: on });
  kit.label(kit.tag(K('d\\X\\,d\\Y\\,d\\Z'), CSS.w), { at: () => box.at(1, 0, 1), dx: 86, dy: -10, opacity: on });

  const S = panel('g6');
  S.label('Kit calls on screen');
  code(S, 'paramSolid({ r: sphMap({ rho, phi, th }) })');
  code(S, 'paramSolid({ r: cylMap({ r, th, z }) })');
  code(S, 'paramSolid({ r: boxMap({ x, y, z }) })');
  code(S, 'paramSurface({ r: (u, v) =&gt; spherical(2.6, u*π/2, v*2π) })');
  S.text('paramSolid draws the image of a unit cube under any map, so one object covers every coordinate system — and any 3D change of variables.', { size: 26, wrap: true, gap: 40 });
}

// ---------------------------------------------------------------- 7 · vector field, path, line integral
function fields() {
  const on = vis('g7'), draw = prog('g7', 0.08, 0.4), up = prog('g7', 0.52, 0.78);
  const F = (x, y) => [-(y - 2.5) * 0.8, (x - 2.5) * 0.8, 0];
  const path = t => [0.6 + 3.8 * t, 0.9 + 3.3 * t * t, 0];
  const along = t => { const a = path(t - 1e-4), b = path(t + 1e-4), d = [b[0] - a[0], b[1] - a[1]], f = F(...path(t)); return (f[0] * d[0] + f[1] * d[1]) / Math.hypot(...d); };
  kit.vectorField({ F, points: kit.gridPoints({ x: [0.25, 4.75, 10], y: [0.25, 4.75, 10] }), scale: 0.3, color: kit.sunset(0, 2.6), opacity: () => 0.9 * on() });
  kit.curve({ r: path, color: C.ink, width: 5, draw, opacity: on });
  kit.fence({ path, top: (x, y, t) => along(t), n: 48, color: kit.signed(-2, 2), grow: up, opacity: () => 0.6 * on(), outline: on });
  kit.label(kit.tag(K('C')), { at: path(0.62), dx: 30, dy: 26, opacity: on });

  const S = panel('g7');
  S.label('Kit calls on screen');
  code(S, 'vectorField({ F, points: gridPoints({ x: [..], y: [..] }) })');
  code(S, 'curve({ r: path, draw })');
  code(S, 'fence({ path, top: (x, y, t) =&gt; F·T })');
  S.text('The fence stands on the path with height F · T, so its signed area is the line integral.', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`\int_C \mathbf{F}\cdot\mathbf{T}\,ds`, { size: 44, gap: 20 });
  return up;
}

// ---------------------------------------------------------------- 8 · normals and flux
function flux() {
  const on = vis('g8'), g = prog('g8', 0.1, 0.5);
  const cap = (u, v) => { const x = 0.8 + 3.4 * u, y = 0.8 + 3.4 * v; return [x, y, 1.1 + 1.7 * Math.exp(-((x - 2.5) ** 2 + (y - 2.5) ** 2) / 2.2)]; };
  kit.paramSurface({ r: cap, nu: 32, nv: 32, color: C.D, opacity: () => 0.5 * on(), iso: { u: 8, v: 8 }, edge: 0.8 });
  const uv = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) uv.push([(i + 0.5) / 6, (j + 0.5) / 6]);
  const pts = uv.map(([u, v]) => cap(u, v));
  kit.vectorField({ F: (x, y, z, i) => kit.surfaceNormal(cap, ...uv[i]), points: pts, scale: 0.55, color: C.ink, opacity: on });
  kit.vectorField({ F: () => [0.45, 0, 1], points: pts, scale: () => 1.0 * g(), color: C.u, width: 3.5, opacity: on });

  const S = panel('g8');
  S.label('Kit calls on screen');
  code(S, 'paramSurface({ r: (u, v) =&gt; [x, y, z] })');
  code(S, 'vectorField({ F: (x, y, z, i) =&gt; surfaceNormal(r, ...uv[i]), points })');
  S.text(`White: unit normals ${K('\\mathbf{n}')}. Orange: a field ${K('\\mathbf{F}')} passing through.`, { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`\iint_S \mathbf{F}\cdot\mathbf{n}\,dS`, { size: 44, gap: 20 });
}

// ---------------------------------------------------------------- 9 · change of variables
function changeOfVariables() {
  const on = vis('g9'), m = prog('g9', 0.25, 0.7);
  kit.axes({ x: [-0.5, 3.6], y: [-0.5, 3.6], ticks: { x: [1, 2, 3], y: [1, 2, 3] }, grid: { x: [0, 3], y: [0, 3], step: 1 }, opacity: on });
  const gm = kit.gridMap({
    T: (r, th) => [r * Math.cos(th), r * Math.sin(th)], u: [0.5, 3, 5], v: [0, Math.PI / 2, 6], morph: m, opacity: on,
    cell: { u: [2, 2.5], v: [Math.PI / 6, Math.PI / 3], opacity: 0.7 },
  });
  kit.label(kit.tag(K('\\Delta A \\approx r\\,\\Delta r\\,\\Delta\\theta'), CSS.z), { at: () => gm.at(2.5, Math.PI / 3), dx: 110, dy: -30, opacity: () => on() * m() });
  kit.label(kit.tag(K('\\Delta r\\,\\Delta\\theta'), CSS.z), { at: () => gm.at(2.5, Math.PI / 3), dx: 70, dy: -26, opacity: () => on() * (1 - m()) });

  const S = panel('g9');
  S.label('Kit calls on screen');
  code(S, 'gridMap({ T: (r, θ) =&gt; [r cos θ, r sin θ],');
  code(S, '&emsp;&emsp;u: [0.5, 3, 5], v: [0, π/2, 6], morph, cell })', { gap: 2 });
  S.text('The grid starts as plain (r, θ) rectangles and slides to its image. The highlighted cell shows what the map does to area.', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`dA = \left|\frac{\partial(x,y)}{\partial(r,\theta)}\right| dr\,d\theta = r\,dr\,d\theta`, { size: 34, gap: 30 });
}

// ---------------------------------------------------------------- 10 · the solid between two surfaces
function between2() {
  const on = vis('g10');
  const bowl = (x, y) => x * x + y * y, dom = kit.overPolar(0, 2, 0, 1.5 * Math.PI);
  kit.graphSurface({ f: bowl, domain: dom, nu: 20, nv: 56, color: kit.sunset(0, 4), iso: { u: 4, v: 12 }, opacity: on });
  kit.graphSurface({ f: () => 4, domain: dom, nu: 20, nv: 56, color: C.v, lit: false, opacity: () => 0.4 * on(), walls: 0.7, base: bowl, edge: 0.9 });

  const S = panel('g10');
  S.label('Kit calls on screen');
  code(S, 'graphSurface({ f: bowl, domain })');
  code(S, 'graphSurface({ f: () =&gt; 4, domain, walls: 0.7, base: bowl })');
  S.text('walls drop from a surface\'s boundary to base — here the lower surface — which closes off the solid. Stopping θ at 3π/2 gives a cutaway.', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`V = \iint_{\D}\bigl(4 - (\X^2+\Y^2)\bigr)\,dA`, { size: 38, gap: 30 });
}

// ---------------------------------------------------------------- 11 · Lagrange multipliers
function lagrange() {
  const on = vis('g11'), s = prog('g11', 0.1, 0.8);
  kit.contours({ f: (x, y) => x * y, levels: [-2, -1, 1, 2, 3], x: [-3, 3], y: [-3, 3], n: 72, color: kit.signed(-3, 3), width: 2.5, opacity: on });
  kit.curve({ r: t => [2 * Math.cos(t), 2 * Math.sin(t), 0], range: [0, TAU], color: C.z, opacity: on });
  const pt = () => { const th = lerp(-0.35, Math.PI / 4, s()); return [2 * Math.cos(th), 2 * Math.sin(th), 0]; };
  const gf = () => { const [x, y] = pt(); return [x + 0.5 * y, y + 0.5 * x, 0]; };   // ∇(xy) = (y, x)
  const gg = () => { const [x, y] = pt(); return [x + 0.42 * x, y + 0.42 * y, 0]; }; // ∇(x² + y²) ∝ (x, y)
  kit.point({ at: pt, opacity: on });
  kit.arrow({ from: pt, to: gg, color: C.z, opacity: on });
  kit.arrow({ from: pt, to: gf, color: C.u, opacity: on });
  kit.label(kit.tag(K('\\nabla f'), CSS.u), { at: gf, dx: -34, dy: -30, opacity: on });
  kit.label(kit.tag(K('\\nabla g'), CSS.z), { at: gg, dx: 44, dy: 14, opacity: on });

  const S = panel('g11');
  S.label('Kit calls on screen');
  code(S, 'contours({ f: (x, y) =&gt; x*y, levels, color: signed(-3, 3) })');
  code(S, 'curve({ r: t =&gt; [2 cos t, 2 sin t, 0] })&ensp;<span class="dim">// g = 4</span>');
  code(S, 'arrow({ from, to })');
  S.text('Slide along the constraint: the extreme value is where a level curve is tangent to it, so the two gradients line up.', { size: 26, wrap: true, gap: 40 });
  S.math(String.raw`\nabla f = \lambda\,\nabla g`, { size: 44, gap: 24 });
}

export default function build() {
  chapters([
    ['g1', '1', 'Regions and bounds'], ['g2', '2', 'Graphs and level curves'], ['g3', '3', 'Slices, tangent planes, gradients'],
    ['g4', '4', 'Riemann sums'], ['g5', '5', 'Polar regions'], ['g6', '6', 'Volume elements'], ['g7', '7', 'Fields and line integrals'],
    ['g8', '8', 'Normals and flux'], ['g9', '9', 'Change of variables'], ['g10', '10', 'Between two surfaces'], ['g11', '11', 'Lagrange multipliers'],
  ]);
  bounds(); surface(); tangent(); riemann(); polarScene(); solids();
  const tilt = fields();
  flux(); changeOfVariables(); between2(); lagrange();

  // Two shared sets of axes: one with the region in the first quadrant, one centred on the origin.
  kit.axes({
    x: [-0.5, 5.6], y: [-0.5, 5.6], z: [0, 4.6], ticks: { z: [1, 2, 3, 4] },
    opacity: any(vis('g2'), vis('g3'), vis('g4'), vis('g7'), vis('g8')),
    zOpacity: any(vis('g2'), vis('g3'), vis('g4'), vis('g8'), () => vis('g7')() * tilt()),
  });
  const ring = [-3, -2, -1, 1, 2, 3];
  kit.axes({
    x: [-3.3, 3.3], y: [-3.3, 3.3], z: [0, 4.8], ticks: { x: ring, y: ring, z: [1, 2, 3, 4] }, grid: { x: [-3, 3], y: [-3, 3], step: 1 },
    opacity: any(vis('g5'), vis('g6'), vis('g10'), vis('g11')), zOpacity: any(vis('g5'), vis('g6'), vis('g10')),
  });

  const order = ['g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9', 'g10', 'g11'];
  const camera = steps(V.g1, [
    ...order.map(id => [`${id}-0.45`, 0.9, V[id]]),
    [T('g7') + 0.5 * (T('g7$') - T('g7')), 1.6, V.g7b],
  ]);
  return { camera };
}
