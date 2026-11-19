# Making a video

This is the method that produced `videos/average-value-triangle`. It assumes you have read `CLAUDE.md`.

## 1. Plan the explanation before any code

Work out what the viewer is confused about and what picture resolves it. Then split the video into scenes, one idea each. For every scene decide:

- what is on screen when it starts and when it ends;
- the one thing that moves or appears, and which spoken word triggers it;
- what the text column says (it should carry the equations; the 3D view carries the geometry).

Things that have worked:

- **Show the wrong picture, then transform it into the right one.** The parabola drawn flat on the triangle's axes, then swung up into the z direction, did more than any sentence.
- **One 3D world for the whole video.** A 2D figure is the same world seen from straight above (polar angle 0). Tilting the camera to reveal the third dimension beats cutting to a different diagram.
- **Tie every equation term to an object.** The strip is "length 5 − x", the curtain is "height 8 − 4x²", their product is the integrand.
- **Make numbers visible.** Columns that level out to the average; tile counts whose mean settles.

Recompute every number yourself. Source material — including an answer key — can be wrong.

## 2. Write the narration

`narration.json` is a list of cues:

```json
[
  {"id": "1a", "scene": "s1", "text": "First, what you actually submitted."},
  {"id": "1b", "scene": "s1", "text": "Look at the bounds.", "gap": 1.1},
  {"id": "p1", "scene": "s2", "silence": 3.0}
]
```

- `id` is how scenes refer to the cue. `scene` groups consecutive cues; a scene id must not also be a cue id.
- `gap` is the silence after the cue (default 0.3 s). Give the last cue of each scene about 1.1 s so the transition has room, and the last cue of the video about 2.5 s.
- `silence` makes a silent beat of that many seconds instead of speech.
- To set the voice for a video, wrap the list: `{"voice": "am_michael", "speed": 1.0, "cues": [...]}`. The default is `af_heart`.

Writing for a speech model:

- Spell out maths as it is read aloud: "f of x, y", "the integral from zero to five", "d x, d y", "negative twenty-six thirds", "the x y plane". Whisper confirmed all of these read correctly with the default voice.
- One or two sentences per cue. Each cue is a unit you can sync to and re-record on its own; clips are cached by text, so editing one cue re-synthesises only that cue.
- Commas make short pauses, full stops longer ones. Use them to separate symbols: "eight minus four x squared, d x, d y".
- Avoid homophones that matter in context ("plain average" in a video about planes). `hear` will show you what a listener would hear.
- Say the word you want to trigger on. If a highlight should land on "denominator", the sentence has to contain it.

Then:

```
./studio narrate <name>
./studio words <name>        # or: ./studio words <name> 4c 4d
./studio hear <name>
```

## 3. Build the visuals

`video.js` exports one function that builds everything once and returns the camera. Follow the layout used by the examples:

```js
export default function build() {
  const P = tracks();   // values over time: steps(), between(), after(), pulses()
  world3d(P);           // kit objects reading those values
  panels(P);            // the text column
  return { camera: P.cam };
}
```

**Tracks.** Anything that changes is a function of no arguments that reads the clock:

```js
P.cam = steps(V.flat, [['3b@height', 3.0, V.tilted], ['4a+0.1', 2.2, V.wide]]);  // hold, then ease to each target
P.surface = between('4e@copied', 's7$-0.6');   // fades in, stays, fades out
P.grow = after('5b@curtain', 1.0);             // 0 -> 1 once
P.flash = pulses(['1d@precisely', '3a@triangle'], 1.3);  // brief 0 -> 1 -> 0 at each moment
```

Combine them with ordinary arithmetic: `opacity: () => P.surface() * (1 - 0.6 * P.ghost())`.

**The stage.** 1920 × 1080. The 3D picture lives in the left ~1150 px; the text column starts at x = 1200. A camera pose's last two numbers are where its target lands on screen — around (600, 600) keeps the picture clear of the text.

**Camera.** A pose is `[azimuth°, polar°, radius, tx, ty, tz, screenX, screenY]`. Polar 0 with azimuth −90 is a flat 2D view (x right, y up). Polar 55–70 with azimuth −40 to −65 is the standard 3D view. One world unit is about `2015 / radius` pixels. Start from the poses in the examples and adjust by looking at stills.

**Vertical scale.** If function values dwarf the x/y extent, set `world.zs` to a track and squash it on screen, saying so in the narration; give the z axis two tick sets that cross-fade (`showWhenScale`, `hideWhenScale`). Heights passed to kit objects are always in function units.

**Colour means something.** x is lilac, y is green, z and heights are gold, the region is blue, errors are red. The LaTeX macros `\X \Y \Z \D` apply these, so equations and axes agree. Colour a strip by the variable that runs along it.

**The text column.** Add items in order; they stack downward and fade out with the scene:

```js
const S = panel('s2');
S.label('Your answer', { at: 's2+0.2' });
const eq = S.math(String.raw`\htmlClass{coef}{\dfrac{1}{13.5}}\int_0^5 \dots`, { at: '2a', size: 46 });
ring(eq, '.coef', between('2a@number', '2c@not'), { color: 'var(--bad)' });
show(eq, [['.coef', '2a@number']]);            // reveal a piece when its word is spoken
S.text('The triangle has base 5 and height 5.', { at: '2b@base', gap: 30 });
```

If a scene has more than fits, `S.page('3d')` clears the column at that moment and starts again from the top. The page fails to load, with a message, if a column runs off the bottom.

**Labels in 3D.** `label(tag('height', CSS.z), { at: () => curtain.at(1, 0.5), dx: 120 })`. `at` is a world point; `dx, dy` are screen pixels and do not rotate with the camera, so re-check labels after changing a pose.

## 4. Review

```
./studio sheet <name> --cues                # end state of every cue
./studio sheet <name> --scene s4 --n 8      # eight frames across one scene
./studio sheet <name> 4d@swing+0.6 4d@swing+1.3 4d@swing+2.0   # inside a move
./studio still <name> '4g$' --crop 1150,100,770,520             # the text column at full size
./studio check <name>
```

Each frame carries a badge with its time and cue. Look for: things hidden behind a surface; labels on top of each other or off-frame; an equation revealed before its word; a camera move that leaves the subject small or cut off; text colliding with the picture.

`check` reports **errors** (panel text clipped or colliding, a label cut off by the frame) and **notes** (3D labels overlapping, axis names leaving the frame during a move). Fix errors; look at the moment for each note and decide.

## 5. Render and report

```
./studio selftest <name> --at 4d@swing+1    # optional: confirms frame-exact capture, needs a moment with motion
./studio video <name>
```

Report what you verified and what you could not: you checked frames and the transcript, but you have not heard the voice or felt the pacing.

To change the voice: `./studio narrate <name> --voice am_michael` (others: `af_bella`, `bm_george`, `am_fenrir`), then re-run `hear` and re-render. Word timings change with the voice; everything follows because scenes sync to words.
