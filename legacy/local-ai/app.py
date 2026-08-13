"""FastAPI entry point for the local Braille recognition pipeline."""

from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from braille_detector import (
    BrailleDetector,
    detect_high_contrast,
    pattern_to_unicode,
    select_detection,
)
from braille_translator import BrailleTranslator

BASE_DIR = Path(__file__).resolve().parent
MAX_IMAGE_BYTES = 10 * 1024 * 1024
SUPPORTED_TYPES = {"image/png", "image/jpeg", "image/webp"}


def create_app(detector: Any = None, translator: Any = None) -> FastAPI:
    app = FastAPI(title="Prometheus Champions Local Braille AI")
    app.state.detector = detector
    app.state.translator = translator

    def get_detector() -> BrailleDetector:
        if app.state.detector is None:
            app.state.detector = BrailleDetector(
                BASE_DIR / "models" / "weights" / "yolov8_braille.pt"
            )
        return app.state.detector

    def get_translator() -> BrailleTranslator:
        if app.state.translator is None:
            app.state.translator = BrailleTranslator(
                BASE_DIR / "models" / "braille-byt5-v3"
            )
        return app.state.translator

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/scan")
    async def scan(
        image: UploadFile | None = File(default=None), debug: bool = False
    ) -> dict[str, Any]:
        if image is None:
            raise HTTPException(status_code=400, detail="An image file is required.")
        if image.content_type not in SUPPORTED_TYPES:
            raise HTTPException(
                status_code=415,
                detail="Unsupported image type. Use PNG, JPEG, or WebP.",
            )

        data = await image.read(MAX_IMAGE_BYTES + 1)
        await image.close()
        if not data:
            raise HTTPException(status_code=400, detail="The image file is empty.")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Image is too large. The maximum size is 10 MB.",
            )

        try:
            with Image.open(BytesIO(data)) as opened:
                opened.verify()
            with Image.open(BytesIO(data)) as opened:
                pil_image = opened.convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError):
            raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

        yolo_cells = get_detector().detect(pil_image)
        detection = select_detection(yolo_cells, detect_high_contrast(pil_image))
        detected_cell_count = sum(len(line) for line in detection.lines)
        if not detected_cell_count:
            result = {
                "text": "",
                "confidence": 0.0,
                "brailleStandard": "UEB_UNCONTRACTED",
                "lines": [],
                "warnings": ["No Braille cells were detected."],
            }
            if debug:
                result["debug"] = {
                    "method": detection.method,
                    "cellCount": 0,
                    "patterns": [],
                    "unicodeBraille": "",
                    "cellBoundaries": [],
                }
            return result

        translated_lines = []
        unicode_lines = []
        patterns = []
        cell_boundaries = []
        for index, line in enumerate(detection.lines):
            unicode_braille = "".join(pattern_to_unicode(cell.pattern) for cell in line)
            unicode_lines.append(unicode_braille)
            patterns.extend(cell.pattern for cell in line)
            cell_boundaries.extend(
                {
                    "lineIndex": index,
                    "cellIndex": cell_index,
                    "xMin": cell.x_center - cell.width / 2,
                    "xMax": cell.x_center + cell.width / 2,
                    "yMin": cell.y_center - cell.height / 2,
                    "yMax": cell.y_center + cell.height / 2,
                    "pattern": cell.pattern,
                }
                for cell_index, cell in enumerate(line)
            )
            translated_lines.append(
                {"lineIndex": index, "text": get_translator().translate(unicode_braille)}
            )

        result = {
            "text": "\n".join(line["text"] for line in translated_lines),
            "confidence": detection.confidence,
            "brailleStandard": "UEB_UNCONTRACTED",
            "lines": translated_lines,
            "warnings": [],
        }
        if debug:
            result["debug"] = {
                "method": detection.method,
                "cellCount": detected_cell_count,
                "patterns": patterns,
                "unicodeBraille": "\n".join(unicode_lines),
                "cellBoundaries": cell_boundaries,
            }
        return result

    return app


app = create_app()
