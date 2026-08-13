export interface FingerPoint {
  timestampMs: number;
  x: number;
  y: number;
  confidence: number;
  lineIndex: number;
}

export interface ReadingAnalysis {
  readingSpeedWpm: number;
  rereadCount: number;
  skippedRegionCount: number;
  pauseCount: number;
  durationSeconds: number;
  pointsAnalyzed: number;
}

export interface TrackingPoint {
  x: number;
  y: number;
  confidence: number;
}
