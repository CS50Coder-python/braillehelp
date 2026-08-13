import { describe, expect, it } from 'vitest';
import { analyzeReading } from './readingAnalyzer';
import type { FingerPoint } from './types';

const point = (timestampMs: number, x: number, y = 0.1, lineIndex = 0): FingerPoint => ({
  timestampMs,
  x,
  y,
  confidence: 0.9,
  lineIndex
});

describe('analyzeReading', () => {
  it('handles an empty point array', () => {
    expect(analyzeReading([], 10, 0, 60_000, 4)).toEqual({
      readingSpeedWpm: 10,
      rereadCount: 0,
      skippedRegionCount: 0,
      pauseCount: 0,
      durationSeconds: 60,
      pointsAnalyzed: 0
    });
  });

  it('calculates rounded WPM', () => {
    expect(analyzeReading([], 21, 0, 90_000, 4).readingSpeedWpm).toBe(14);
  });

  it('ignores small jitter when counting rereads', () => {
    const points = [point(0, 0.5), point(100, 0.48), point(200, 0.51)];
    expect(analyzeReading(points, 10, 0, 1000, 4).rereadCount).toBe(0);
  });

  it('counts one large backward movement as one reread', () => {
    const points = [point(0, 0.7), point(100, 0.55)];
    expect(analyzeReading(points, 10, 0, 1000, 4).rereadCount).toBe(1);
  });

  it('counts one large forward jump as one possible skipped region', () => {
    const points = [point(0, 0.2), point(100, 0.45)];
    expect(analyzeReading(points, 10, 0, 1000, 4).skippedRegionCount).toBe(1);
  });

  it('counts one continuous stationary period as one pause', () => {
    const points = [
      point(0, 0.4),
      point(500, 0.405),
      point(1000, 0.4),
      point(1600, 0.405),
      point(2400, 0.4)
    ];
    expect(analyzeReading(points, 10, 0, 2500, 4).pauseCount).toBe(1);
  });

  it('uses cooldowns to prevent duplicate movement events', () => {
    const points = [
      point(0, 0.9),
      point(100, 0.75),
      point(200, 0.6),
      point(1000, 0.35),
      point(1100, 0.6),
      point(1200, 0.85)
    ];
    const result = analyzeReading(points, 10, 0, 1500, 4);
    expect(result.rereadCount).toBe(2);
    expect(result.skippedRegionCount).toBe(1);
  });

  it('returns zero WPM for an empty passage', () => {
    expect(analyzeReading([], 0, 0, 60_000, 4).readingSpeedWpm).toBe(0);
  });
});
