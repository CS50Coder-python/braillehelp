import sys
import unittest
from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from braille_detector import BrailleCell, detect_high_contrast, pattern_to_unicode
from braille_translator import BrailleTranslator


def png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (32, 32), "white").save(output, format="PNG")
    return output.getvalue()


def synthetic_braille_png(
    patterns: list[str],
    *,
    inverted: bool = False,
    column_spacing: int = 28,
    row_spacing: int = 28,
    cell_pitch: int = 84,
) -> bytes:
    """Render six-dot patterns on a fixed lattice; 000000 creates a word gap."""
    margin = 28
    radius = 7
    width = margin * 2 + max(1, len(patterns)) * cell_pitch
    height = margin * 2 + row_spacing * 2
    background = "black" if inverted else "white"
    foreground = "white" if inverted else "black"
    image = Image.new("RGB", (width, height), background)
    draw = ImageDraw.Draw(image)
    for cell_index, pattern in enumerate(patterns):
        left_x = margin + cell_index * cell_pitch
        for position, occupied in enumerate(pattern):
            if occupied != "1":
                continue
            column = position // 3
            row = position % 3
            x = left_x + column * column_spacing
            y = margin + row * row_spacing
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=foreground,
            )
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


class FakeDetector:
    def __init__(self, cells):
        self.cells = cells

    def detect(self, _image):
        return self.cells


class FakeTranslator:
    def __init__(self, translations=None):
        self.translations = iter(translations or [])
        self.inputs = []

    def translate(self, braille):
        self.inputs.append(braille)
        return next(self.translations)


class AppTests(unittest.TestCase):
    def client(self, cells=(), translations=()):
        return TestClient(
            create_app(FakeDetector(list(cells)), FakeTranslator(list(translations)))
        )

    def test_health(self):
        response = self.client().get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_missing_image(self):
        response = self.client().post("/scan")
        self.assertEqual(response.status_code, 400)

    def test_unsupported_image_type(self):
        response = self.client().post(
            "/scan", files={"image": ("braille.txt", b"text", "text/plain")}
        )
        self.assertEqual(response.status_code, 415)

    def test_successful_mocked_recognition(self):
        cells = [
            BrailleCell("100000", 0.8, 10, 10, 5, 8),
            BrailleCell("110000", 1.0, 20, 10, 5, 8),
        ]
        translator = FakeTranslator(["ab"])
        client = TestClient(create_app(FakeDetector(cells), translator))
        response = client.post(
            "/scan", files={"image": ("braille.png", png_bytes(), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "text": "ab",
                "confidence": 0.9,
                "brailleStandard": "UEB_UNCONTRACTED",
                "lines": [{"lineIndex": 0, "text": "ab"}],
                "warnings": [],
            },
        )
        self.assertEqual(translator.inputs, ["\u2801\u2803"])

    def test_no_detections(self):
        response = self.client().post(
            "/scan", files={"image": ("braille.png", png_bytes(), "image/png")}
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "")
        self.assertEqual(response.json()["confidence"], 0.0)
        self.assertTrue(response.json()["warnings"])

    def test_unicode_hello_translates_to_hello(self):
        self.assertEqual(BrailleTranslator().translate("⠓⠑⠇⠇⠕"), "hello")

    def recognize_synthetic(self, patterns, *, inverted=False):
        low_confidence_yolo = [
            BrailleCell("110111", 0.61, 800, 275, 170, 246),
            BrailleCell("010111", 0.40, 800, 275, 170, 246),
            BrailleCell("010101", 0.34, 1145, 280, 118, 241),
        ]
        client = TestClient(
            create_app(FakeDetector(low_confidence_yolo), BrailleTranslator())
        )
        response = client.post(
            "/scan?debug=true",
            files={
                "image": (
                    "synthetic.png",
                    synthetic_braille_png(patterns, inverted=inverted),
                    "image/png",
                )
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["debug"]["method"], "opencv")
        self.assertEqual(response.json()["debug"]["patterns"], patterns)
        self.assertEqual(len(response.json()["debug"]["cellBoundaries"]), len(patterns))
        return response.json()

    def test_black_dot_image_returns_hello(self):
        patterns = ["110010", "100010", "111000", "111000", "101010"]
        result = self.recognize_synthetic(patterns)
        self.assertEqual(result["text"], "hello")
        self.assertEqual(result["debug"]["unicodeBraille"], "⠓⠑⠇⠇⠕")

    def test_white_dot_image_returns_hello(self):
        patterns = ["110010", "100010", "111000", "111000", "101010"]
        result = self.recognize_synthetic(patterns, inverted=True)
        self.assertEqual(result["text"], "hello")
        self.assertEqual(result["debug"]["unicodeBraille"], "⠓⠑⠇⠇⠕")

    def test_keep_uses_missing_columns_without_losing_cells(self):
        patterns = ["101000", "100010", "100010", "111100"]
        result = self.recognize_synthetic(patterns)
        self.assertEqual(result["text"], "keep")
        self.assertEqual(result["debug"]["unicodeBraille"], "⠅⠑⠑⠏")

    def test_climbing_uses_consistent_cell_pitch(self):
        patterns = [
            "100100",
            "111000",
            "010100",
            "101100",
            "110000",
            "010100",
            "101110",
            "110110",
        ]
        result = self.recognize_synthetic(patterns)
        self.assertEqual(result["text"], "climbing")
        self.assertEqual(result["debug"]["unicodeBraille"], "⠉⠇⠊⠍⠃⠊⠝⠛")

    def test_larger_gap_becomes_a_word_space(self):
        patterns = [
            "101000",
            "100010",
            "100010",
            "111100",
            "000000",
            "100100",
            "111000",
            "010100",
            "101100",
            "110000",
            "010100",
            "101110",
            "110110",
        ]
        result = self.recognize_synthetic(patterns)
        self.assertEqual(result["text"], "keep climbing")
        self.assertEqual(result["debug"]["unicodeBraille"], "⠅⠑⠑⠏⠀⠉⠇⠊⠍⠃⠊⠝⠛")

    def test_high_contrast_cells_remain_left_to_right(self):
        image_data = synthetic_braille_png(
            ["110010", "100010", "111000", "111000", "101010"]
        )
        with Image.open(BytesIO(image_data)) as image:
            detection = detect_high_contrast(image.convert("RGB"))
        self.assertIsNotNone(detection)
        line = detection.lines[0]
        self.assertEqual([cell.x_center for cell in line], sorted(cell.x_center for cell in line))
        self.assertEqual(
            "".join(pattern_to_unicode(cell.pattern) for cell in line),
            "⠓⠑⠇⠇⠕",
        )

    def test_debug_data_is_omitted_by_default(self):
        client = TestClient(create_app(FakeDetector([]), BrailleTranslator()))
        response = client.post(
            "/scan",
            files={
                "image": (
                    "braille.png",
                    synthetic_braille_png(
                        ["110010", "100010", "111000", "111000", "101010"]
                    ),
                    "image/png",
                )
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("debug", response.json())


if __name__ == "__main__":
    unittest.main()
