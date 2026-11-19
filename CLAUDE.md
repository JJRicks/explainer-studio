# Explainer studio

This repo makes narrated 3D explainer videos for calculus (built for multivariable, usable for anything with graphs and equations). You write a narration script and a scene file; the studio speaks the narration, syncs the visuals to the spoken words, and renders an MP4.

You cannot watch the video or hear the audio. Everything here is set up so you can still verify your work: look at stills, run the layout check, and read the transcript of what the voice actually said. Do all three before saying a video is done.

## The loop

```
./studio new <name>                 # copy videos/_template
# 1. write videos/<name>/narration.json
./studio narrate <name>             # speech + timeline.json (word-level timestamps)
./studio words <name>               # the words you can sync to, with times
# 2. write videos/<name>/video.js
./studio sheet <name> --cues        # one half-size frame per narration cue -> PNG contact sheets
./studio sheet <name> 4b@swing 4b@swing+1 '4b$' # or any moments you name (quote $ and #)
./studio still <name> 212.5 --crop 1150,100,770,520   # full-size detail
./studio check <name>               # clipped or overlapping text, across the whole video
./studio hear <name>                # Whisper transcript beside the script
./studio video <name>               # out/<name>.mp4, 1080p60, about 6 min per 7.5 min of video
```

Read the PNGs the tools print with your image-reading tool. Iterate on `sheet` until every scene looks right; a full `video` render is the last step, not a way to check.

## Rules that keep the output correct

1. **Everything is a function of time.** A frame is rendered by setting `clock.t` and re-reading every value. Never use `Date.now()`, timers, CSS transitions or animations, or state carried from one frame to the next. If frame N depends on frame N-1 having been drawn, capture will be wrong.
2. **Sync to words, not seconds.** Write times as expressions — `'3e@negative'`, `'4d@swing+0.5'`, `'s3$-0.6'` — never as raw seconds. Rewording a line then moves everything with it. Run `./studio words` to see what is available.
3. **Look before you claim.** A frame you have not looked at is a frame you have not verified. After any change to camera, layout or timing, re-run `sheet` for the scenes it touches.
4. **Write LaTeX with `String.raw`.** In ordinary strings every backslash must be doubled and one slip prints a stray character. Also write `.js` files with your file-writing tool, not a shell heredoc: shells have eaten `\\;` here before.
5. **Narration is for the ear.** Spell maths the way it is said ("eight minus four x squared", "d x, d y"), one idea per cue, and re-run `hear` after any wording change.
6. **Change `core/` only for things every video would want.** One video's special object belongs in that video's file (see the circuit board in `videos/average-value-triangle/video.js`). If you do change `core/`, re-render the gallery: `./studio sheet kit-gallery --cues` and `./studio check kit-gallery`.

## Where things are

| Path | What |
|---|---|
| `videos/<name>/narration.json` | the script: cues grouped into scenes |
| `videos/<name>/video.js` | the visuals: one `build()` that returns `{ camera }` |
| `videos/_template/` | minimal starting point |
| `videos/kit-gallery/` | every kit object in action — the cookbook and the regression test |
| `videos/average-value-triangle/` | a full 7.5-minute video — the worked example |
| `core/engine.js` | time helpers, text and equation layer, camera, line and mesh primitives |
| `core/panel.js` | the text column on the right (flow layout) |
| `core/kit/` | 3D objects: axes, regions, surfaces, curves, fields, columns, solids, marks |
| `tools/` | the CLI, the TTS script, the listening check |
| `docs/GUIDE.md` | how to plan and build a video, step by step |
| `docs/API.md` | reference for everything importable |
| `docs/PITFALLS.md` | mistakes already made once — read before your first video |

## Before you call a video done

- `./studio check <name>` reports no errors, and you have looked at each note it printed.
- `./studio hear <name>` shows every line understood; anything marked `!!` is only numerals or punctuation.
- You have looked at a `--cues` sheet of the final state of every scene, plus the middle of every camera move.
- Nothing important is hidden behind a surface, off the edge of the frame, or on top of other text.
- The numbers on screen are right: recompute them, do not copy them from the source material.
- Tell the user what you could not verify (how the voice sounds, pacing by ear).

## Setup on a new machine

```
npm install
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

Needs Node 20+, Python 3.10–3.12, `ffmpeg`, and Google Chrome (or `CHROME=/path/to/chrome`). The first `narrate` downloads the Kokoro voice model (about 330 MB). `hear` needs Apple silicon (`mlx-whisper`). The gallery uses silent cues, so `./studio narrate kit-gallery && ./studio sheet kit-gallery --cues` works without any speech model and is the quickest way to confirm an install.
