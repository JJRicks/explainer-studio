# API reference

Imports in a video file:

```js
import { steps, between, after, pulses, world, K, ring, show } from '../../core/engine.js';
import * as kit from '../../core/kit/index.js';       // or named imports
import { panel, chapters, OK, NO } from '../../core/panel.js';
```

Conventions used everywhere:

- **Animated options.** Any option documented as a number, array or colour may instead be a function of no arguments returning that value. It is re-read every frame.
- **Heights are in function units.** Points are `[x, y, height]`; the kit multiplies the third component by `world.zs()`. Only `label`'s `at` and the points returned by handles (`.at()`) are in world units, already scaled.
- **Time expressions.** Anywhere a time is accepted: seconds, or `'4b'` (cue start), `'4b$'` (cue end), `'4b@leave'` (a word), `'4b@the#2'` (second occurrence), `'4b@leave$'` (word end), `'s3'` / `'s3$'` (scene start / end), each optionally `+0.5` or `-0.6`.

## Time — `core/engine.js`

| | |
|---|---|
| `T(expr)` | time expression → seconds |
| `steps(init, [[time, seconds, target], ...])` | keyframed value: holds `init`, then eases to each target starting at its time. Numbers or equal-length arrays (poses, ranges). Returns `() => value`. |
| `between(t0, t1, fadeIn = 0.5, fadeOut = 0.45)` | `() => 0..1`, visible from t0 until t1 (fade-out starts at t1) |
| `after(t0, seconds = 0.6)` | `() => 0..1`, a one-way ramp |
| `pulses([t, ...], seconds = 0.9)` | `() => 0..1`, a bump at each time — for flashes and emphasis |
| `ramp(t0, d)`, `win(t0, t1, din, dout)`, `bump(t0, d)` | the same shapes evaluated now; take seconds, not expressions |
| `clock.t` | the current time; read it inside your own functions |
| `cs(id, off)`, `ce(id, off)`, `wd(id, word, n, off)` | older spellings of `T('id')`, `T('id$')`, `T('id@word#n')` |
| `lerp`, `lerp3`, `smooth`, `clamp01`, `val` | small maths helpers; `val(x)` calls x if it is a function |
| `world.zs` | set to `() => scale` to squash or stretch all heights; `Z(v)` applies it |
| `onFrame(fn)` | run `fn` every frame — for bespoke objects |

## Text and equations — `core/engine.js`

| | |
|---|---|
| `K(latex)` | LaTeX → HTML string, for embedding in text. Macros: `\X \Y \Z` (coloured variables), `\D \R` (region). |
| `defineMacros({ '\\F': '8-4\\X^2' })` | add macros for this video |
| `mk(html, opts)`, `tx(latex, opts)` | place raw HTML / an equation at stage pixels `x, y`, or following a 3D point `pos`. Options: `a` (opacity fn), `s` (scale fn), `size`, `w`, `color`, `cls`, `ax, ay` (anchor), `dx, dy`, `f(el, alpha)` per-frame hook, `nolint`. Prefer `panel` and `label`. |
| `ring(node, selector, alphaFn, { color, pad })` | outline part of an equation |
| `strike(node, selector, progressFn)` | strike part of an equation through |
| `reveal(node, selector, alphaFn)` | fade part of an equation on its own schedule |
| `show(node, [[selector, time], ...])` | reveal several parts, each at its time expression |

Mark parts of an equation with `\htmlClass{name}{...}` and select them as `'.name'`. A selector may list several (`'.inner, .dx'`); a ring then encloses them all.

CSS classes for text: `lbl` (small caps label), `dim`, `bold`, `bad`, `good`, `cx cy cz cD` (variable colours), `knum` (digits in the maths font, for numbers updated by an `f` hook), `box`, `card`, `tag`. CSS variables: `--x --y --z --D --u --v --w --bad --good --ink --dim`.

## The text column — `core/panel.js`

```js
const S = panel('s3', { y: 150 });         // options: x, y, w, out (when the whole column fades)
S.label('Example', { at: '3d+0.2' });      // small caps heading
S.math(String.raw`f(2,3) = -8`, { at: '3e@f', size: 42 });
S.text('Still inside the triangle.', { at: '3f@input', size: 28, wrap: true });
S.gap(20);                                  // extra space before the next item
S.page('3g');                               // clear the column at this time and start again at the top
```

Item options: `at`, `out`, `size`, `gap` (space above, replacing the default), `wrap`, `same` (stay on the previous item's row; combine with `dx`), `over` (sit exactly on the previous item — overlays), `dx`, `cls`, `color`, `f`. Each call returns the node, for `ring` / `show` / `strike`.

`chapters([[sceneId, badge, title], ...])` puts a title above the column for each scene. `OK` and `NO` are a green tick and a red cross for inline use.

## Camera — `core/engine.js`

`build()` returns `{ camera }` where `camera()` gives a pose:

`[azimuth°, polar°, radius, targetX, targetY, targetZ, screenX, screenY]`

z is up. Polar 0 looks straight down; with azimuth −90 that is a 2D view with x right and y up. The target appears at stage pixel (screenX, screenY). One world unit ≈ `2015 / radius` px. `camScale()` is `radius / 16.12`: multiply world-space sizes by it to keep them a constant size on screen.

## The kit — `core/kit/`

### Axes

`axes({ x, y, z, ticks, labels, grid, opacity, zOpacity, gridGlow, pulse })`
: `x, y, z` are `[lo, hi]` (z in function units; omit it for 2D). `ticks: { x: [...], y: [...], z: [...] }`, or per axis a list of sets `[{ values, show }, ...]` that cross-fade. `labels: { x: '\\X', ... }`. `grid: { x: [0, 5], y: [0, 5], step: 1 }` or `null`. `zOpacity` is separate so 2D views can hide the z axis. `pulse: { y: fn }` enlarges an axis name briefly.

`showWhenScale(lo, hi)`, `hideWhenScale(lo, hi)`
: `show` functions for tick sets that should appear or vanish as `world.zs` crosses a band.

### Regions and bounds

`region(points, { color, fill, line, width, draw, z, order })` → `{ points, centroid }`
: a filled polygon on the floor. `draw` (0..1) draws the outline on.

`typeI(a, b, lo, hi)`, `typeII(c, d, lo, hi)`, `polarRegion(t0, t1, r0, r1)`
: boundary points for `region`: between two graphs over x, between two graphs over y, or a polar sector (radii may be functions of θ).

`sweep({ type, range, lo, hi, t, grow, lead, paint, painted, ghosts, color })` → `{ start(), end() }`
: strips sweeping across a region — the picture of an iterated integral's bounds. `type: 'I'` is vertical strips (x runs over `range`, each strip from `lo(x)` to `hi(x)`); `'II'` is horizontal. `t` is where the leading strip is; `grow` draws that strip from 0 to 1; `painted` is how far the fill extends (default `t`).

### Surfaces

`graphSurface({ f, domain, color, opacity, iso, edge, walls, base, nu, nv, lit })` → `{ at(u, v), height(u, v) }`
: z = f(x, y) over a domain. `color: sunset(lo, hi)` colours by height. Opacity above 0.6 is solid and hides what is behind; below, see-through. `iso: { u: 10, v: 4, opacity }` draws parameter lines. `edge` is an opacity or `{ opacity, color, width }`. `walls` drops side walls to `base` (a number or `(x, y) => height`), showing the solid under the graph or between two graphs.

Domains map the unit square to a region and may have animated bounds: `rect(x0, x1, y0, y1)`, `overTypeI(a, b, lo, hi)`, `overTypeII(c, d, lo, hi)`, `overPolar(r0, r1, t0, t1)`, or your own `(u, v) => [x, y]`.

`paramSurface({ r, ...same options })`
: any surface `r(u, v) => [x, y, height]`: spheres, cylinders, cones, planes.

`tangentPlane({ f, at, size, color, opacity })`
: the tangent plane to z = f at `at` (`[x, y]` or a function, so it can slide).

### Curves, slices, level curves

`curve({ r, range, n, color, width, opacity, draw })` → `{ at(t), tangent(t) }`
: `r(t) => [x, y, height]`. Graphs of one variable, space curves, paths of integration.

`fence({ path, range, top, base, n, color, opacity, grow, outline, strip })` → `{ at(s, k) }`
: a wall standing on a floor path `s => [x, y]`, from `base` up to `top` (numbers or functions called as `(x, y, s)`). Cross-sections, partial-derivative slices, scalar line integrals. `strip: { color, width, opacity, dots }` also draws the path on the floor.

`contours({ f, levels, x, y, n, color, width, opacity, lift, dynamic })`
: level curves by marching squares. `lift: 1` raises each to its own height. `dynamic: true` recomputes every frame.

### Vectors

`arrow({ from, to, color, width, opacity, head })` → `{ tip() }`

`vectorField({ F, points, scale, maxLength, normalize, color, width, opacity, head })`
: `F(x, y, height, i) => [u, v, w]` at each point. `color` may be a colormap applied to |F|. `scale` may be animated.

`gridPoints({ x: [a, b, n], y: [c, d, n], z, inside })`
: sample points; `z` is a height or `[lo, hi, n]` for a 3D lattice.

### Riemann sums

`columns({ cells, height, color, shrink, opacity })`
: a column on every cell. `height: cell => value` (default the cell's sampled value) — animate it to grow or level the columns. `color` may be `(height, cell) => Color`.

`rectCells({ x: [a, b, nx], y: [c, d, ny], f, inside, sample })`, `triangleCells(A, B, C, n, f)`, `polarCells({ r: [r0, r1, nr], th: [t0, t1, nt], f })`
: tilings. Each cell is `{ poly, cx, cy, area, v }`.

`riemannSum(cells)`, `cellMean(cells)`
: Σ f ΔA and the area-weighted mean.

### Volume elements and substitutions

`paramSolid({ r, n, color, opacity, edges })` → `{ at(a, b, c) }`
: the image of the unit cube under `r(a, b, c) => [x, y, height]`. With `boxMap({ x, y, z })`, `cylMap({ r, th, z })`, `sphMap({ rho, phi, th })` — each range `[lo, hi]`, optionally animated — this is dx dy dz, r dr dθ dz, or ρ² sin φ dρ dφ dθ.

`gridMap({ T, u: [lo, hi, lines], v, morph, cell, colorU, colorV })` → `{ at(u, v) }`
: a (u, v) grid on the floor sliding to its image under `(x, y) = T(u, v)` as `morph` goes 0 → 1. `cell: { u: [u0, u1], v: [v0, v1] }` highlights one cell and its image.

### Marks

`point({ at, color, px, opacity, scale })` → `{ at() }` — a dot of constant screen size.

`segment({ from, to, color, width, opacity, grow, dashed })` → `{ at(u) }` — `dashed: true` or `[dash, gap]` in world units.

`dropLine({ at, z, color, opacity, grow, guides })` → `{ floor(), top() }` — a floor point, dashed guides to the axes, and a dashed vertical to height `z`.

`label(html, { at, dx, dy, opacity, scale, size, cls })` — text following a world point. `tag(html, color)` wraps it in a legible pill.

### Colour and maths

`C` (hex numbers) and `CSS` (strings): `ink dim axis grid bg x y z D u v w bad good`.

`colormap([[value, hex], ...])`, `sunset(lo, hi)`, `signed(lo, hi)`, `solid(hex)` — functions `value => THREE.Color`. The returned colour is a shared instance.

`fx(f, x, y)`, `fy(f, x, y)`, `grad(f)`, `surfaceNormal(r, u, v)`, `polar`, `cylindrical`, `spherical`, `linspace`, `range`, `polyArea`, and vector helpers `add sub scale cross norm unit`.

## Bespoke objects

For anything the kit lacks, build it in the video file from the engine's primitives and drive it with `onFrame`:

- `new Segs(capacity, { color, width, order, colors })` — fat lines: `begin()`, then `seg(a, b)`, `line(points)` or `dashed(a, b, dash, gap)`, then `end(opacity)`.
- `new DynMesh(vertexCount, indexArray, material, { colors, order })` — `v(i, x, y, z)`, `c(i, color)`, `end(opacity, { normals, solidAbove })`.
- `dot(color, px)` → `set(position, opacity, scale)`.
- `THREE` and `scene` for anything static.

Render order: solid, depth-writing meshes use order 1; translucent things come after (floor fills 4, walls 5, lines 5–8, dots 9). Lines and fills do not write depth.

## Command line

Run `./studio` with no arguments for the full list. Review output goes to `out/review/<video>/`, renders to `out/<video>.mp4`.
