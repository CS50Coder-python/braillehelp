import type { FingerPoint, ReadingAnalysis } from './types';

export const BACKWARD_MOVEMENT_THRESHOLD = 0.1;
export const FORWARD_JUMP_THRESHOLD = 0.2;
export const JITTER_THRESHOLD = 0.025;
export const PAUSE_DURATION_MS = 1500;
export const EVENT_COOLDOWN_MS = 750;
export const PAUSE_MOVEMENT_THRESHOLD = 0.035;

export function countPassageWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function emptyAnalysis(durationSeconds: number, pointsAnalyzed: number): ReadingAnalysis {
  return {
    readingSpeedWpm: 0,
    rereadCount: 0,
    skippedRegionCount: 0,
    pauseCount: 0,
    durationSeconds,
    pointsAnalyzed
  };
}

/**
 * Produces MVP instructional indicators from a fingertip trace. These values
 * are approximate signals for teacher review, not medical or educational diagnoses.
 */
export function analyzeReading(
  points: FingerPoint[],
  passageWordCount: number,
  startTimestampMs: number,
  endTimestampMs: number,
  expectedLineCount: number
): ReadingAnalysis {
  const durationMs = Math.max(0, endTimestampMs - startTimestampMs);
  const durationSeconds = durationMs / 1000;
  const result = emptyAnalysis(durationSeconds, points.length);

  if (durationMs > 0 && passageWordCount > 0) {
    result.readingSpeedWpm = Math.max(
      0,
      Math.round(passageWordCount / (durationMs / 60_000))
    );
  }

  if (points.length < 2) return result;

  let lastRereadAt = Number.NEGATIVE_INFINITY;
  let lastSkipAt = Number.NEGATIVE_INFINITY;
  let stationaryStart = points[0].timestampMs;
  let pauseCounted = false;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const sameLine = current.lineIndex === previous.lineIndex;
    const horizontalMovement = current.x - previous.x;
    const distance = Math.hypot(current.x - previous.x, current.y - previous.y);

    if (
      sameLine &&
      horizontalMovement <= -BACKWARD_MOVEMENT_THRESHOLD &&
      Math.abs(horizontalMovement) > JITTER_THRESHOLD &&
      current.timestampMs - lastRereadAt >= EVENT_COOLDOWN_MS
    ) {
      result.rereadCount += 1;
      lastRereadAt = current.timestampMs;
    }

    const jumpedLines =
      Math.min(expectedLineCount, Math.abs(current.lineIndex - previous.lineIndex)) > 1;
    if (
      ((sameLine && horizontalMovement >= FORWARD_JUMP_THRESHOLD) || jumpedLines) &&
      current.timestampMs - lastSkipAt >= EVENT_COOLDOWN_MS
    ) {
      result.skippedRegionCount += 1;
      lastSkipAt = current.timestampMs;
    }

    if (distance <= PAUSE_MOVEMENT_THRESHOLD) {
      if (!pauseCounted && current.timestampMs - stationaryStart >= PAUSE_DURATION_MS) {
        result.pauseCount += 1;
        pauseCounted = true;
      }
    } else {
      stationaryStart = current.timestampMs;
      pauseCounted = false;
    }
  }
  return result;
}
