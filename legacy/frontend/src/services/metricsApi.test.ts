import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadReadingMetrics } from './metricsApi';

const analysis = {
  readingSpeedWpm: 18.7,
  rereadCount: 2,
  skippedRegionCount: 3,
  pauseCount: 1,
  durationSeconds: 125.2,
  pointsAnalyzed: 42
};

describe('uploadReadingMetrics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards the complete RestAPI persistence contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await uploadReadingMetrics(analysis, 120);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/metrics');
    expect(JSON.parse(options.body)).toEqual({
      reading_speed: 19,
      mistakes: 3,
      rereads: 2,
      word_count: 120,
      mistake_ratio: 40,
      duration: '2:05'
    });
  });

  it('surfaces an API error without losing the server message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'The metrics service rejected the update.' }), { status: 502 })));

    await expect(uploadReadingMetrics(analysis, 120)).rejects.toThrow('The metrics service rejected the update.');
  });
});
