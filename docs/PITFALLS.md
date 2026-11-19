# Pitfalls

Every item here cost time once. They are grouped by where you will meet them.

## Seeing the picture

**A solid surface hides the floor under it.** Strips, regions and curtains drawn at z = 0 vanish wherever the surface is above them. When the floor is the point of the scene, drop the surface's opacity to about 0.4 (below 0.6 it stops writing depth and becomes see-through), and bring it back afterwards.

**Function values that dwarf the domain.** A surface that falls to −92 over a 5 × 5 region cannot be drawn 1 : 1. Set `world.zs` and say on screen and in the narration that the vertical scale is squashed. If you need a true-scale moment (a rigid rotation, say), do it at `zs = 1` first and animate the squash afterwards. Give the z axis tick sets that cross-fade with `showWhenScale` / `hideWhenScale`.

**Perspective enlarges what is near the camera.** An axis that fits by arithmetic can still run off the top because its end is closer than the camera target. `./studio check` reports axis names and ticks that leave the frame.

**Label offsets are screen pixels.** `dx, dy` do not rotate with the camera. A label placed for one pose can land on top of something else after a move. Re-check labels whenever a pose changes.

**Top-down views need azimuth −90.** Polar 0 with any other azimuth is still top-down but rotated, and the turn shows as a spin during the tilt into 3D.

**Coplanar things fight.** Kit fills are pushed back with polygon offset and outlines sit 0.002 above them. If you add your own flat geometry, lift it by 0.002–0.006 or reuse `flatMaterial`.

**Dashes are in world units.** A dash pattern tuned at `zs = 1` becomes a few long dashes when heights are squashed. Pass `dashed: [0.1, 0.08]` for short drops.

**Zero-size things.** The kit skips zero-length strips and segments. In bespoke code, do not emit zero-length segments, and give a collapsed surface opacity 0 rather than drawing it.

**Quote time expressions in the shell.** `$-` and `#` mean something to the shell: write `'s3$-0.6'` and `'4b@the#2'` on the command line.

## Equations

**Use `String.raw` for LaTeX.** In a normal string `'\\F\;'` silently becomes `\F;` and prints a semicolon.

**Do not write JavaScript through a shell heredoc.** The shell layer has turned `\\;` into `\;` — and the same thing then corrupted the script meant to repair it. Use your file-writing tool, and for patch scripts spell a backslash as `chr(92)`.

**`\htmlClass` names share the CSS namespace.** `\htmlClass{b}{...}` once came out bold because `.b` was a utility class. Use descriptive names (`coef`, `inner`, `lhs`), not single letters, and not `n`, `k`, `box`, `card`, `tag`, `dim`, `bad`, `good`, `bold`, `wrap`, `math`.

**A minus after `{=}` is binary.** `{=}\;-8` renders as "= − 8" with wide gaps. Write `{-}8`.

**`\htmlClass` groups change spacing.** Wrapping pieces in groups removes TeX's automatic space between them (after `=`, between a fraction and an integral). Put relations in braces — `\;{=}\;` — and add spacing yourself, so a regrouped copy lays out identically.

**Overlays must mirror the grouping.** To add underbraces later, draw a second equation of `\phantom`s on top with `over: true`. Its phantom must have the same group structure as the visible one or it drifts sideways. See scene 6 of the example.

**Rings need room.** Two adjacent ringed pieces need a `\,` between them, and a ring extends `pad` pixels past the glyphs, so leave a little more `gap` above and below a ringed equation.

**Scale with the `s` option.** Setting `el.style.scale` in an `f` hook scales the element's translation too and throws it across the screen.

## Timing

**Never use raw seconds.** They are right until the narration changes.

**A cue id must not equal a scene id.** `'g1$'` would then mean the cue's end, not the scene's, and everything fades early. `narrate` now rejects this.

**`'1e+2'` is cue 1e plus two seconds**, not the number 100. Only plain decimals are read as numbers.

**The word has to exist.** A typo in `'4c@parabolas'` stops the page loading and the error lists the cue's words. Possessives and hyphenated numbers are single tokens: `triangle's`, `twenty-five`.

**Fades take time.** `between(a, b)` starts fading at `b` and takes 0.45 s. Panels fade from 0.6 s before the scene ends, so the next scene's first item should not start before its scene does.

**Anything time-based that is not `clock.t` breaks capture.** That includes CSS transitions, `requestAnimationFrame` counters, and "previous value" variables.

## Narration

**You cannot hear it — `hear` is the check.** Run it after every wording change. It ignores numerals ("8" for "eight") and marks lines where any other word differs with `!!`; read those. It would not catch a wrong number, so skim the rest once.

**Homophones.** "Plain average" was heard as "plane average" in a video full of planes; "y" is heard as "why" (harmless, but keep sentences around it unambiguous).

**Word timings come from the speech model**, so they follow the voice. Changing voice or speed moves every time; scenes follow because they sync to words.

**Kokoro prints `blake2` hash errors on start-up** with some Python builds. They are harmless and the CLI hides them unless the command fails.

## Layout

**The column overflows.** The page refuses to load and says by how much. Shrink gaps, or split the scene's text with `S.page(at)`.

**Long single lines get clipped at the right edge.** `check` reports them. Use `wrap: true`.

**`check` notes are not all problems.** An axis name leaving the frame during a deliberate camera drift is fine. Look at the moment before changing anything.

## Rendering

**Capture is frame-exact, and that is verified, not assumed.** `./studio selftest <video> --at <a moment with motion>` compares a rendered frame with stills one frame either side. Run it after upgrading Chrome or Puppeteer.

**The renderer exits explicitly.** Without `process.exit` the static server's keep-alive sockets held the process open for minutes after the file was written.

**Chrome flags are for macOS.** `--use-angle=metal` selects the GPU path on a Mac. On Linux the launch flags in `tools/studio.mjs` will need changing; this has not been tested there.

**Colour.** Frames are sRGB PNG, encoded to H.264 with the BT.709 matrix and tagged as such. Do not remove the `scale=...out_color_matrix=bt709` filter or colours shift.
