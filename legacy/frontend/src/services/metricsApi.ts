import type { ReadingAnalysis } from '../ai/types';

export interface MetricsPayload {
  reading_speed: number;
  mistakes: number;
  rereads: number;
}

export async function uploadReadingMetrics(analysis: ReadingAnalysis): Promise<void> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const payload: MetricsPayload = {
    reading_speed: analysis.readingSpeedWpm,
    mistakes: analysis.skippedRegionCount,
    rereads: analysis.rereadCount
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
