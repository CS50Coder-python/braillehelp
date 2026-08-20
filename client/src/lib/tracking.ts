export type RegionEvent = "first_region" | "advance" | "reread" | "skip" | "same_region";

export type MotionPoint = { x: number; y: number; normalizedMotion: number; detected: boolean; changedRatio: number };

export function estimateMotionPoint(frame: Uint8ClampedArray, previous: Uint8ClampedArray | null, width: number, height: number, threshold = 28): MotionPoint {
  if (!previous || previous.length !== frame.length) return { x: 0, y: 0.5, normalizedMotion: 0, detected: false, changedRatio: 0 };
  let totalDifference = 0;
  let changedPixels = 0;
  let changedX = 0;
  let changedY = 0;
  for (let index = 0; index < frame.length; index += 4) {
    const pixelDifference = Math.abs(frame[index] - previous[index]) + Math.abs(frame[index + 1] - previous[index + 1]) + Math.abs(frame[index + 2] - previous[index + 2]);
    totalDifference += pixelDifference;
    if (pixelDifference > threshold) {
      const pixelIndex = index / 4;
      changedPixels += 1;
      changedX += pixelIndex % width;
      changedY += Math.floor(pixelIndex / width);
    }
  }
  const pixelCount = Math.max(1, frame.length / 4);
  const changedRatio = changedPixels / pixelCount;
  const normalizedMotion = Math.min(1, totalDifference / 120000);
  const detected = changedPixels >= Math.max(1, Math.ceil(pixelCount * 0.002)) && normalizedMotion >= 0.005;
  return {
    x: detected ? Math.max(0, Math.min(1, changedX / changedPixels / width)) : 0,
    y: detected ? Math.max(0, Math.min(1, changedY / changedPixels / height)) : 0.5,
    normalizedMotion,
    detected,
    changedRatio,
  };
}

export function stabilizeMotionPoint(previous: { x: number; y: number } | null, candidate: MotionPoint, smoothing = 0.42, maxJump = 0.32): MotionPoint | null {
  if (!candidate.detected) return null;
  if (!previous) return candidate;
  const jump = Math.hypot(candidate.x - previous.x, candidate.y - previous.y);
  if (jump > maxJump) return null;
  const alpha = Math.max(0.15, Math.min(0.8, smoothing));
  return {
    x: previous.x + (candidate.x - previous.x) * alpha,
    y: previous.y + (candidate.y - previous.y) * alpha,
    normalizedMotion: Math.min(1, jump * 8),
    detected: true,
    changedRatio: candidate.changedRatio,
  };
}

export type VisualCandidate = { x: number; y: number; confidence: number; detected: boolean };

/** Acquires a compact, persistent warm/high-contrast foreground candidate inside the camera frame. */
export function estimateVisualCandidate(frame: Uint8ClampedArray, width: number, height: number, previous: { x: number; y: number } | null = null): VisualCandidate {
  const step = 2;
  const gridWidth = Math.ceil(width / step);
  const gridHeight = Math.ceil(height / step);
  const mask = new Uint8Array(gridWidth * gridHeight);
  for (let gy = 0; gy < gridHeight; gy++) for (let gx = 0; gx < gridWidth; gx++) {
    const x = Math.min(width - 1, gx * step);
    const y = Math.min(height - 1, gy * step);
    const index = (y * width + x) * 4;
    const r = frame[index] / 255;
    const g = frame[index + 1] / 255;
    const b = frame[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const fingertipLike = max > 0.68 && chroma > 0.12 && ((r > b * 1.08 && g > b * 1.02) || chroma > 0.22);
    if (fingertipLike) mask[gy * gridWidth + gx] = 1;
  }
  const seen = new Uint8Array(mask.length);
  const components: Array<{ x: number; y: number; size: number; compactness: number }> = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let sumX = 0;
    let sumY = 0;
    let minX = gridWidth;
    let minY = gridHeight;
    let maxX = 0;
    let maxY = 0;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor];
      const gx = index % gridWidth;
      const gy = Math.floor(index / gridWidth);
      sumX += gx;
      sumY += gy;
      minX = Math.min(minX, gx);
      minY = Math.min(minY, gy);
      maxX = Math.max(maxX, gx);
      maxY = Math.max(maxY, gy);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
        const next = ny * gridWidth + nx;
        if (mask[next] && !seen[next]) { seen[next] = 1; queue.push(next); }
      }
    }
    if (queue.length >= 8) {
      const boxArea = Math.max(1, (maxX - minX + 1) * (maxY - minY + 1));
      components.push({ x: sumX / queue.length / Math.max(1, gridWidth - 1), y: sumY / queue.length / Math.max(1, gridHeight - 1), size: queue.length, compactness: queue.length / boxArea });
    }
  }
  if (!components.length) return { x: previous?.x ?? 0, y: previous?.y ?? 0.5, confidence: 0, detected: false };
  const ranked = components.map((component) => {
    const distance = previous ? Math.hypot(component.x - previous.x, component.y - previous.y) : 0;
    const proximity = previous ? Math.max(0, 1 - distance * 2.4) : 0.5;
    const sizePenalty = Math.min(1, component.size / Math.max(8, gridWidth * gridHeight * 0.12));
    return { component, score: component.compactness * 0.55 + proximity * 0.35 + sizePenalty * 0.1 };
  }).sort((a, b) => b.score - a.score);
  const selected = ranked[0].component;
  const confidence = Math.min(0.9, 0.4 + selected.compactness * 0.35 + Math.min(0.2, selected.size / 500));
  return { x: selected.x, y: selected.y, confidence, detected: confidence >= 0.48 };
}

export function estimateHorizontalPosition(frame: Uint8ClampedArray, previous: Uint8ClampedArray | null, width: number, threshold = 28) {
  const point = estimateMotionPoint(frame, previous, width, Math.max(1, Math.floor(frame.length / 4 / width)), threshold);
  return { position: point.x, normalizedMotion: point.normalizedMotion };
}

export function applyCalibration(position: number, phoneHeightMeters: number) {
  const scale = Math.max(0.7, Math.min(1.3, 1.5 / Math.max(0.3, phoneHeightMeters)));
  return Math.max(0, Math.min(1, 0.5 + (position - 0.5) * scale));
}

export function classifyRegionTransition(previousRegion: number, currentRegion: number, visitedRegions: Set<number>): RegionEvent {
  if (previousRegion < 0) return "first_region";
  if (currentRegion === previousRegion) return "same_region";
  if (visitedRegions.has(currentRegion)) return "reread";
  if (currentRegion > previousRegion + 1) return "skip";
  return "advance";
}
