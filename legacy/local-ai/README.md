# Local Braille AI service

This FastAPI service keeps Braille image recognition on the local machine:

1. Ultralytics YOLO detects six-dot Braille cells.
2. Bounding-box centers are clustered into top-to-bottom lines and sorted
   left-to-right.
3. Each six-character class label is mapped to Unicode Braille.
4. The local `braille-byt5-v3` model translates each line to English.

## Model and label assumptions

The detector must be at `models/weights/yolov8_braille.pt` and the translator
must be at `models/braille-byt5-v3/`. No model is downloaded at runtime.

A YOLO label such as `101000` is interpreted as dots 1 through 6 in that
order. Each `1` sets the corresponding Unicode Braille bit, so `100000` is
U+2801 (`⠁`). Dots 7 and 8 remain unset. If the checkpoint was trained with a
different bit order, `pattern_to_unicode` in `braille_detector.py` must be
adapted.

For YOLO results, response confidence is the arithmetic mean of every detected
cell's box confidence. It measures detector confidence only; the translation
model does not provide a calibrated confidence. When there are no detections,
confidence is `0.0`, text is empty, and the response includes a warning.

Clean, high-contrast images also run through a deterministic OpenCV parser.
It accepts circular, consistently sized connected components in either
foreground polarity, fits them to three-row/two-column cell grids, and uses
that result when YOLO is low-confidence, produces overlapping or implausible
cells, disagrees on cell count, or has a weaker quality score. For this path,
`confidence` is the documented structural quality score: 45% component
circularity, 25% dot-size consistency, and 30% grid fit. It is not a
probability or translation confidence.

Horizontal parsing fits one origin, one within-cell column spacing, and one
cell pitch across each line. Every dot is assigned to its nearest row, cell,
and column slot; unseen slots remain zero bits. Missing whole cell positions
become Unicode Braille spaces, allowing larger inter-word gaps without using
image shapes as English text.

Append `?debug=true` to `/scan` to include the selected detector method, cell
count, fitted cell boundaries, six-bit patterns, and pre-translation Unicode
Braille. Debug data is omitted by default.

## Install and run

From the repository root:

```sh
local-ai/.venv/bin/python -m pip install -r local-ai/requirements.txt
cd local-ai
.venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

The service exposes `GET /health` and multipart `POST /scan`. The scan field is
named `image`; PNG, JPEG, and WebP files up to 10 MB are accepted. Uploads are
decoded in memory and are never permanently stored.

Run its model-free tests from the repository root:

```sh
local-ai/.venv/bin/python -m unittest discover -s local-ai/tests -v
```

## Backend integration

The Node backend defaults to the local provider. Its relevant environment
settings are:

```sh
BRAILLE_PROVIDER=local
LOCAL_BRAILLE_SERVICE_URL=http://127.0.0.1:8000
```

Set `BRAILLE_PROVIDER=openai` and `OPENAI_API_KEY=...` to use the existing
OpenAI implementation instead.
