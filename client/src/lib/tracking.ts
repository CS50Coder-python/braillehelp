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
