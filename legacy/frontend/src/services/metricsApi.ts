import type { ReadingAnalysis } from '../ai/types';

export interface MetricsPayload {
  reading_speed: number;
  mistakes: number;
  rereads: number;
  word_count: number;
  mistake_ratio: number;
  duration: string;
}

function formatDuration(durationSeconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function uploadReadingMetrics(analysis: ReadingAnalysis, passageWordCount: number): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const mistakes = Math.max(0, analysis.skippedRegionCount);
  const wordCount = Math.max(0, Math.round(passageWordCount));
  const payload: MetricsPayload = {
    reading_speed: Math.max(0, Math.round(analysis.readingSpeedWpm)),
    mistakes,
    rereads: Math.max(0, Math.round(analysis.rereadCount)),
    word_count: wordCount,
    mistake_ratio: wordCount === 0 ? 0 : wordCount / Math.max(mistakes, 1),
    duration: formatDuration(analysis.durationSeconds)
  };

  const response = await fetch(`${apiUrl}/api/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Metrics could not be uploaded.');
  }
}
