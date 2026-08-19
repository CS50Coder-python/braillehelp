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

/** Acquires a persistent warm/high-contrast foreground candidate inside the camera frame. This is a fallback for devices where landmark WASM cannot initialize. */
export function estimateVisualCandidate(frame: Uint8ClampedArray, width: number, height: number, previous: { x: number; y: number } | null = null): VisualCandidate {
  const points: Array<{ x: number; y: number; weight: number }> = [];
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const index = (y * width + x) * 4;
    const r = frame[index] / 255;
    const g = frame[index + 1] / 255;
    const b = frame[index + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const warm = (r > b * 1.04 && g > b * 1.01 && chroma > 0.05 && max > 0.14) || (chroma > 0.16 && max > 0.2);
    if (!warm) continue;
    const nx = x / Math.max(1, width - 1);
    const ny = y / Math.max(1, height - 1);
    const distance = previous ? Math.hypot(nx - previous.x, ny - previous.y) : 0;
    const weight = (0.5 + chroma) * (previous ? Math.max(0.05, 1 - distance * 1.8) : 1);
    points.push({ x: nx, y: ny, weight });
  }
  if (points.length < 18) return { x: previous?.x ?? 0, y: previous?.y ?? 0.5, confidence: 0, detected: false };
  const weightTotal = points.reduce((sum, point) => sum + point.weight, 0);
  const x = points.reduce((sum, point) => sum + point.x * point.weight, 0) / weightTotal;
  const y = points.reduce((sum, point) => sum + point.y * point.weight, 0) / weightTotal;
  return { x, y, confidence: Math.min(0.82, 0.35 + points.length / 700), detected: true };
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
