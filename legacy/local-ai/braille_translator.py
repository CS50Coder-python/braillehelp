"""Rule-based uncontracted UEB Braille-to-English translation."""

from pathlib import Path


LETTER_MAP = {
    "⠁": "a",
    "⠃": "b",
    "⠉": "c",
    "⠙": "d",
    "⠑": "e",
    "⠋": "f",
    "⠛": "g",
    "⠓": "h",
    "⠊": "i",
    "⠚": "j",
    "⠅": "k",
    "⠇": "l",
    "⠍": "m",
    "⠝": "n",
    "⠕": "o",
    "⠏": "p",
    "⠟": "q",
    "⠗": "r",
    "⠎": "s",
    "⠞": "t",
    "⠥": "u",
    "⠧": "v",
    "⠺": "w",
    "⠭": "x",
    "⠽": "y",
    "⠵": "z",
}

DIGIT_MAP = {
    "⠁": "1",
    "⠃": "2",
    "⠉": "3",
    "⠙": "4",
    "⠑": "5",
    "⠋": "6",
    "⠛": "7",
    "⠓": "8",
    "⠊": "9",
    "⠚": "0",
}

PUNCTUATION_MAP = {
    "⠂": ",",
    "⠆": ";",
    "⠒": ":",
    "⠲": ".",
    "⠖": "!",
    "⠦": "?",
    "⠄": "'",
    "⠤": "-",
}

CAPITAL_INDICATOR = "⠠"
NUMBER_INDICATOR = "⠼"
BRAILLE_SPACE = "⠀"


class BrailleTranslator:
    """Decode uncontracted Unified English Braille.

    The model_path argument remains for compatibility with the existing
    FastAPI application, but no translation model is loaded.
    """

    def __init__(self, model_path: Path | str | None = None) -> None:
        self.model_path = model_path

    def translate(self, braille: str) -> str:
        if not braille:
            return ""

        output: list[str] = []
        capitalize_next = False
        number_mode = False

        for cell in braille:
            if cell in {" ", BRAILLE_SPACE, "\n", "\t"}:
                if output and output[-1] != " ":
                    output.append(" ")
                number_mode = False
                capitalize_next = False
                continue

            if cell == CAPITAL_INDICATOR:
                capitalize_next = True
                continue

            if cell == NUMBER_INDICATOR:
                number_mode = True
                continue

            if number_mode and cell in DIGIT_MAP:
                output.append(DIGIT_MAP[cell])
                continue

            if number_mode:
                number_mode = False

            letter = LETTER_MAP.get(cell)
            if letter is not None:
                if capitalize_next:
                    letter = letter.upper()
                    capitalize_next = False

                output.append(letter)
                continue

            punctuation = PUNCTUATION_MAP.get(cell)
            if punctuation is not None:
                output.append(punctuation)
                capitalize_next = False
                continue

            # Preserve uncertainty instead of silently inventing a character.
            output.append("?")
            capitalize_next = False

        return "".join(output).strip()