"""Transcribe every narration clip with Whisper and print it beside the script.

    python tools/hear.py videos/<name>

An agent cannot listen to the audio; this is the substitute. Lines marked "!!" differ from the
script in some word other than a number: read those pairs. Typical findings are mispronounced
maths ("d x" heard as "the x") and homophones that would confuse a listener ("plain average"
heard as "plane average" in a video full of planes; "y" heard as "why").

Numbers are ignored in the comparison, because Whisper writes "4x squared" where the script
says "four x squared". Skim the unmarked lines once anyway — a wrong number would not be flagged.
"""
import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import mlx_whisper

MODEL = "mlx-community/whisper-large-v3-turbo"
NUMBER_WORDS = set(
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen "
    "seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand point "
    "half halves third thirds quarter quarters".split()
)


def letters(text):
    """Lower-case letters only, with digits and number words removed, so spacing and numerals do not matter."""
    words = re.sub(r"[^a-z0-9 ]", " ", text.lower().replace("-", " ")).split()
    return "".join(re.sub(r"\d", "", w) for w in words if w not in NUMBER_WORDS)


root = Path(sys.argv[1])
spec = json.loads((root / "narration.json").read_text())
cues = spec["cues"] if isinstance(spec, dict) else spec
flagged = 0
for cue in cues:
    if "silence" in cue:
        continue
    heard = mlx_whisper.transcribe(str(root / "audio" / f"{cue['id']}.wav"), path_or_hf_repo=MODEL, language="en", verbose=None)["text"].strip()
    same = letters(heard) == letters(cue["text"])
    flagged += not same
    mark = "  " if same else "!!"
    print(f"{mark} {cue['id']} SAID : {cue['text']}\n{mark} {cue['id']} HEARD: {heard}\n")
print(f"{flagged} line(s) marked !! — read each one and decide whether a listener would be misled." if flagged
      else "Every line matched the script (numbers aside).")
