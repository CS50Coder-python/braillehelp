"""YOLO Braille-cell detection and reading-order utilities."""

from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Sequence

import cv2
import numpy as np
from PIL import Image
from ultralytics import YOLO


@dataclass(frozen=True)
class BrailleCell:
    pattern: str
    confidence: float
    x_center: float
    y_center: float
    width: float
    height: float


@dataclass(frozen=True)
class DetectionResult:
    lines: list[list[BrailleCell]]
    method: str
    confidence: float


class BrailleDetector:
    def __init__(self, model_path: Path | str) -> None:
        self.model = YOLO(str(model_path))

    def detect(self, image: Image.Image) -> list[BrailleCell]:
        result = self.model.predict(source=image, verbose=False)[0]
        names = result.names
        cells: list[BrailleCell] = []

        for box in result.boxes:
            class_index = int(box.cls.item())
            pattern = str(names[class_index])
            if len(pattern) != 6 or set(pattern) - {"0", "1"}:
                raise ValueError(f"Unexpected YOLO class label: {pattern!r}")
            x1, y1, x2, y2 = (float(value) for value in box.xyxy[0].tolist())
            cells.append(
                BrailleCell(
                    pattern=pattern,
                    confidence=float(box.conf.item()),
                    x_center=(x1 + x2) / 2,
                    y_center=(y1 + y2) / 2,
                    width=x2 - x1,
                    height=y2 - y1,
                )
            )
        return cells


def _cluster_axis(values: Sequence[float], tolerance: float) -> list[float]:
    clusters: list[list[float]] = []
    for value in sorted(values):
        if not clusters or value - (sum(clusters[-1]) / len(clusters[-1])) > tolerance:
            clusters.append([value])
        else:
            clusters[-1].append(value)
    return [sum(cluster) / len(cluster) for cluster in clusters]


def _circular_components(mask: np.ndarray) -> list[dict[str, float]]:
    image_area = mask.shape[0] * mask.shape[1]
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    components: list[dict[str, float]] = []
    for index in range(1, count):
        x, y, width, height, area = (int(value) for value in stats[index])
        if not (image_area * 0.00005 <= area <= image_area * 0.02):
            continue
        if width < 4 or height < 4 or not 0.65 <= width / height <= 1.35:
            continue

        component_mask = np.uint8(labels[y:y + height, x:x + width] == index) * 255
        contours, _ = cv2.findContours(
            component_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            continue
        contour = max(contours, key=cv2.contourArea)
        perimeter = cv2.arcLength(contour, True)
        circularity = (
            4 * np.pi * cv2.contourArea(contour) / (perimeter * perimeter)
            if perimeter > 0
            else 0.0
        )
        fill_ratio = area / (width * height)
        if circularity < 0.68 or fill_ratio < 0.55:
            continue
        components.append(
            {
                "x": float(centers[index][0]),
                "y": float(centers[index][1]),
                "width": float(width),
                "height": float(height),
                "circularity": float(min(1.0, circularity)),
            }
        )
    return components


def _fit_horizontal_lattice(
    components: list[dict[str, float]],
    rows: Sequence[float],
    diameter: float,
) -> tuple[float, float, float, list[tuple[dict[str, float], int, int, float]]] | None:
    """Fit x = origin + cell_index * pitch + column * column_spacing.

    Candidate pitches are evaluated against every dot rather than inferred
    from gaps between occupied columns. Collision penalties reject fits that
    would place two visible dots in the same six-position lattice slot.
    """
    x_centers = _cluster_axis(
        [component["x"] for component in components], max(2.0, diameter * 0.55)
    )
    adjacent_gaps = [
        right - left
        for left, right in zip(x_centers, x_centers[1:])
        if right - left >= diameter * 0.65
    ]
    if not adjacent_gaps:
        return None

    column_spacing = min(adjacent_gaps)
    pitch_candidates = {column_spacing * 2.9}
    for left_index, left in enumerate(x_centers):
        for right in x_centers[left_index + 1:]:
            difference = right - left
            for cell_steps in range(1, len(x_centers) + 1):
                pitch = difference / cell_steps
                if column_spacing * 2.25 <= pitch <= column_spacing * 3.75:
                    pitch_candidates.add(pitch)

    best = None
    for pitch in pitch_candidates:
        for anchor in x_centers:
            for anchor_column in (0, 1):
                origin = anchor - anchor_column * column_spacing
                assignments = []
                occupied_slots = set()
                collision_count = 0
                residual_total = 0.0
                for component in components:
                    choices = []
                    for column in (0, 1):
                        raw_index = (
                            component["x"] - origin - column * column_spacing
                        ) / pitch
                        cell_index = round(raw_index)
                        predicted_x = (
                            origin + cell_index * pitch + column * column_spacing
                        )
                        choices.append(
                            (abs(component["x"] - predicted_x), cell_index, column)
                        )
                    residual, cell_index, column = min(choices)
                    row = min(
                        range(3),
                        key=lambda index: abs(component["y"] - rows[index]),
                    )
                    slot = (cell_index, column, row)
                    if slot in occupied_slots:
                        collision_count += 1
                    occupied_slots.add(slot)
                    residual_total += (residual / max(column_spacing, 1)) ** 2
                    assignments.append((component, cell_index, column, residual))

                cell_indices = {assignment[1] for assignment in assignments}
                empty_indices = (
                    max(cell_indices) - min(cell_indices) + 1 - len(cell_indices)
                )
                score = (
                    residual_total / len(assignments)
                    + collision_count * 5
                    + empty_indices * 0.002
                    + abs(pitch / column_spacing - 2.9) * 0.0005
                )
                if best is None or score < best[0]:
                    best = (score, origin, pitch, assignments)

    if best is None:
        return None
    _, origin, pitch, assignments = best
    maximum_residual = max(assignment[3] for assignment in assignments)
    if maximum_residual > column_spacing * 0.45:
        return None
    return origin, pitch, column_spacing, assignments


def _parse_components(components: list[dict[str, float]]) -> DetectionResult | None:
    if len(components) < 2:
        return None

    diameter = median(
        (component["width"] + component["height"]) / 2 for component in components
    )
    row_centers = _cluster_axis(
        [component["y"] for component in components], max(2.0, diameter * 0.65)
    )
    if len(row_centers) < 3 or len(row_centers) % 3:
        return None

    parsed_lines: list[list[BrailleCell]] = []
    grid_residuals: list[float] = []
    for line_index in range(0, len(row_centers), 3):
        rows = row_centers[line_index:line_index + 3]
        row_spacing = median([rows[1] - rows[0], rows[2] - rows[1]])
        if row_spacing < diameter * 0.65:
            return None
        line_components = [
            component
            for component in components
            if rows[0] - row_spacing * 0.55
            <= component["y"]
            <= rows[2] + row_spacing * 0.55
        ]
        if not line_components:
            continue

        lattice = _fit_horizontal_lattice(line_components, rows, diameter)
        if lattice is None:
            return None
        origin, cell_pitch, column_spacing, assignments = lattice
        first_cell = min(assignment[1] for assignment in assignments)
        last_cell = max(assignment[1] for assignment in assignments)
        cells: list[BrailleCell] = []
        for cell_index in range(first_cell, last_cell + 1):
            pattern = ["0"] * 6
            cell_assignments = [
                assignment
                for assignment in assignments
                if assignment[1] == cell_index
            ]
            for dot, _, column, horizontal_residual in cell_assignments:
                row = min(range(3), key=lambda index: abs(dot["y"] - rows[index]))
                pattern[row + column * 3] = "1"
                grid_residuals.append(
                    (
                        abs(dot["y"] - rows[row])
                        + horizontal_residual
                    )
                    / max(diameter * 2, 1)
                )

            left_x = origin + cell_index * cell_pitch
            x_center = left_x + column_spacing / 2
            cells.append(
                BrailleCell(
                    pattern="".join(pattern),
                    confidence=0.0,
                    x_center=x_center,
                    y_center=(rows[0] + rows[2]) / 2,
                    width=cell_pitch,
                    height=rows[2] - rows[0] + diameter,
                )
            )
        parsed_lines.append(cells)

    if not parsed_lines or any(not line for line in parsed_lines):
        return None

    sizes = np.array(
        [(component["width"] + component["height"]) / 2 for component in components]
    )
    size_consistency = max(0.0, 1.0 - float(np.std(sizes) / max(np.mean(sizes), 1)))
    circularity = sum(component["circularity"] for component in components) / len(components)
    grid_fit = max(0.0, 1.0 - (sum(grid_residuals) / max(len(grid_residuals), 1)))
    quality = max(
        0.0,
        min(1.0, 0.45 * circularity + 0.25 * size_consistency + 0.30 * grid_fit),
    )
    parsed_lines = [
        [
            BrailleCell(
                pattern=cell.pattern,
                confidence=quality,
                x_center=cell.x_center,
                y_center=cell.y_center,
                width=cell.width,
                height=cell.height,
            )
            for cell in line
        ]
        for line in parsed_lines
    ]
    return DetectionResult(parsed_lines, "opencv", quality)


def detect_high_contrast(image: Image.Image) -> DetectionResult | None:
    """Parse clean circular-dot Braille in either foreground polarity.

    Otsu thresholding is tried in both directions. Only similarly sized,
    circular connected components that form complete three-row grids are
    accepted, which prevents this path from replacing YOLO for ordinary
    photographed or embossed pages.
    """
    grayscale = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2GRAY)
    candidates: list[DetectionResult] = []
    for threshold_type in (cv2.THRESH_BINARY, cv2.THRESH_BINARY_INV):
        _, mask = cv2.threshold(
            grayscale, 0, 255, threshold_type | cv2.THRESH_OTSU
        )
        parsed = _parse_components(_circular_components(mask))
        if parsed is not None:
            candidates.append(parsed)
    return max(candidates, key=lambda result: result.confidence, default=None)


def select_detection(
    yolo_cells: Sequence[BrailleCell],
    opencv_result: DetectionResult | None,
) -> DetectionResult:
    yolo_lines = sort_cells_into_lines(yolo_cells)
    yolo_confidence = (
        sum(cell.confidence for cell in yolo_cells) / len(yolo_cells)
        if yolo_cells
        else 0.0
    )
    duplicate_boxes = any(
        abs(first.x_center - second.x_center) < min(first.width, second.width) * 0.25
        and abs(first.y_center - second.y_center) < min(first.height, second.height) * 0.25
        for index, first in enumerate(yolo_cells)
        for second in yolo_cells[index + 1:]
    )
    yolo_plausible = bool(yolo_cells) and yolo_confidence >= 0.60 and not duplicate_boxes

    if opencv_result is not None and opencv_result.confidence >= 0.75:
        opencv_count = sum(len(line) for line in opencv_result.lines)
        count_disagrees = bool(yolo_cells) and len(yolo_cells) != opencv_count
        opencv_stronger = opencv_result.confidence > yolo_confidence + 0.10
        if not yolo_plausible or count_disagrees or opencv_stronger:
            return opencv_result

    return DetectionResult(yolo_lines, "yolo", yolo_confidence)


def sort_cells_into_lines(cells: Sequence[BrailleCell]) -> list[list[BrailleCell]]:
    """Cluster cells by vertical center, then order every line left-to-right.

    A cell joins a line when its center is within 60% of the median detected
    cell height from that line's running vertical center. This accommodates
    modest skew while keeping neighboring rows separate.
    """
    if not cells:
        return []

    tolerance = max(1.0, median(cell.height for cell in cells) * 0.6)
    lines: list[list[BrailleCell]] = []

    for cell in sorted(cells, key=lambda item: (item.y_center, item.x_center)):
        best_line = None
        best_distance = float("inf")
        for line in lines:
            line_center = sum(item.y_center for item in line) / len(line)
            distance = abs(cell.y_center - line_center)
            if distance <= tolerance and distance < best_distance:
                best_line = line
                best_distance = distance
        if best_line is None:
            lines.append([cell])
        else:
            best_line.append(cell)

    lines.sort(key=lambda line: sum(cell.y_center for cell in line) / len(line))
    return [sorted(line, key=lambda cell: cell.x_center) for line in lines]


def pattern_to_unicode(pattern: str) -> str:
    """Convert a six-bit label to Unicode Braille.

    The checkpoint labels are interpreted in Unicode dot order: characters
    1..6 represent dots 1, 2, 3, 4, 5, and 6. A ``1`` sets the corresponding
    bit in the Braille Patterns code point (U+2800 + bit mask). Dots 7 and 8
    are unset because this is six-dot Braille.
    """
    if len(pattern) != 6 or set(pattern) - {"0", "1"}:
        raise ValueError(f"Invalid six-bit Braille pattern: {pattern!r}")
    mask = sum((1 << index) for index, value in enumerate(pattern) if value == "1")
    return chr(0x2800 + mask)
